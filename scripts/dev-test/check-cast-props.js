// Dev-only check for cast properties (docs/PLAN-cast-properties.md), against this lane's dev server, on a fixture of its own
// (zt_cp_ people: zt_cp_desk a site admin, zt_cp_jo who plays). The ZT CP Yacht is a made show (a series whose season plays by
// a rulebook from blocks, as Make it a game leaves one): Season 1 premieres in a week, its rulebook Below Deck's library one
// (department, and the job inside it, shown under a name), its six crew approved with no properties yet.
//   1. The rulebook on the desk (chunk 1): Who's playing lists the properties; an "Age" property is refused in the sheet (Done
//      off, the reason said); one added (Status, Veteran or Rookie) and saved as Fix a mistake; the server took it; the
//      summary line says what they're sorted by. A player is refused the rulebook.
//   2. The cast on the desk (chunk 2): the cast's question asks each property and a bio; a paste with every crew member's
//      department, job and bio (one value not the rulebook's, dropped) is staged, not written; its line counts the details and
//      bios; What changed shows them (filling in, no choice); someone new joins with theirs; Send writes season_cast.props and
//      .bio and the cast's log; a second paste with a different job is a Keep ours / Use theirs choice, kept by default; Undo of
//      the first send puts them back; Override on a castaway's page (a listed value refused, then set; a bio) with History and
//      Undo. In the browser at --width: the review sheet and the castaway page.
//   3. The cast tab and the sheet (chunk 3), the crew given departments, jobs, a status (Veteran or Rookie) and bios, jo following
//      the season before its premiere: the stats read carries the properties and each person's values and bio; a game's stamp
//      (cast-props.ts stampCastProps) gives each castaway's values by id and is left out of a save; in the browser at --width,
//      the wall grouped by department in the rulebook's order with each job under a name, the Status chips (All, Veteran 4,
//      Rookie 2) filtering it, the Gender chips every show has (Man 3, Woman 3), and a face opening who they are before any
//      results (the bio line and its billing line).
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
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

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
// [name, department, job, hometown, age, occupation]: a charter crew, as the network bills it (made up).
const CREW = [
  ["Kip Hale", "Bridge", "Captain", "Halifax, NS", 52, "Yacht captain"],
  ["Ana Monroe", "Interior", "Chief stew", "Ocean City, NJ", 31, "Chief stewardess"],
  ["Dee Kwon", "Interior", "Second stew", "Perth, Australia", 26, "Stewardess"],
  ["Finn Bligh", "Deck", "Bosun", "Cork, Ireland", 29, "Bosun"],
  ["Gus Penn", "Deck", "Deckhand", "Tampa, FL", 24, "Deckhand"],
  ["Rae Stone", "Galley", "Chef", "Cape Town, South Africa", 34, "Private chef"],
];
/** A cast answer as our bot would give one: every crew member's department, job and bio (and one more who joins). */
const answer = (o = {}) =>
  JSON.stringify({
    castaways: [
      ...CREW.map(([name, department, job, hometown, age, occupation]) => ({
        name,
        photoUrl: "",
        properties: { department: name === "Gus Penn" ? "Engine room" : department, job: (o.jobs && o.jobs[name]) || job },
        bio: { hometown, age, occupation, line: name === "Ana Monroe" ? "Runs the interior like a five-star hotel." : "", source: "https://example.com/zt-cp-yacht/cast" },
      })),
      { name: "Lou Marsh", photoUrl: "", properties: { department: "Deck", job: "Deckhand" }, bio: { hometown: "Bristol, UK", age: 27, occupation: "Deckhand" } },
    ],
    sources: ["https://example.com/zt-cp-yacht/cast"],
  });

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

async function part2(pool, ids) {
  const desk = await api({ user: U("desk"), pass: PASSWORD });
  const cast = (body) => desk.call("POST", `/api/desk/seasons/${ids.s1}/cast`, body);
  const page = async () => (await desk.call("GET", `/api/desk/seasons/${ids.s1}/cast`)).body;
  const rows = async () => Object.fromEntries((await pool.query("SELECT name, props, bio FROM season_cast WHERE season_id = $1", [ids.s1])).rows.map((r) => [r.name, r]));

  const q = await desk.call("GET", `/api/desk/seasons/${ids.s1}/cast/question`);
  check(/"department": "Their department at the start of the season: exactly one of/.test(q.body.prompt) && /"bio": \{/.test(q.body.prompt), "2: the cast's question asks each property and a bio", `${q.status} ${JSON.stringify(q.body).slice(0, 300)}`);

  let r = await cast({ paste: answer() });
  check(r.status === 200 && /6 people's details, 6 bios, 1 new|1 new, 5 people's details, 6 bios|1 new, 6 people's details, 6 bios/.test(r.body.text), "2: a paste is staged with its details and bios counted", JSON.stringify(r.body));
  check(Object.values(await rows()).every((x) => !Object.keys(x.props).length && !x.bio), "2: staged, not written");
  let p = await page();
  const ch = p.review.changes.map((c) => c.change);
  const gus = ch.find((c) => c.k === "props" && c.name === "Gus Penn");
  check(gus && gus.to.job === "Deckhand" && !gus.to.department, "2: a value not the rulebook's is dropped (Gus's \"Engine room\")", JSON.stringify(gus));
  check(ch.find((c) => c.k === "add")?.props?.job === "Deckhand", "2: someone new comes with theirs");

  // In the browser: the review sheet.
  if (out) {
    const { page: b, close } = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
    try {
      await b.goto(`${process.env.BASE}/desk/season/${ids.s1}/cast`);
      await b.locator("[data-cast-see]").click();
      await b.locator("[data-cast-diff]").waitFor({ timeout: 15000 });
      await settle(b);
      const words = await b.locator("[data-cast-diff]").innerText();
      check(/Ana: Interior · Chief stew/.test(words) && /We have nothing yet: it fills in/.test(words) && /Ana's bio: Ocean City, NJ · 31 · Chief stewardess/.test(words), "2: What changed shows each person's details and bio", words.slice(0, 300));
      check((await b.locator('[data-change="props"] [role="radiogroup"]').count()) === 0, "2: filling in asks nothing");
      await b.screenshot({ path: path.join(out, "2-what-changed.jpg"), type: "jpeg", quality: 82 });
      check(!(await b.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "2: nothing wider than the screen");
    } finally {
      await close();
    }
  }

  const pre = await cast({ send: true, answer: p.review.answerId, picks: {}, preview: true });
  check(pre.status === 200 && pre.body.lines.some((l) => /people's details/.test(l.label) || /Interior · Chief stew/.test(l.change)), "2: Send's preview names the details", JSON.stringify(pre.body.lines.map((l) => `${l.label}: ${l.change}`)));
  r = await cast({ send: true, answer: p.review.answerId, picks: {} });
  check(r.status === 200, "2: sent", JSON.stringify(r.body));
  const firstSend = r.body.changeId;
  let now = await rows();
  check(now["Ana Monroe"].props.department === "Interior" && now["Ana Monroe"].props.job === "Chief stew" && now["Ana Monroe"].bio.hometown === "Ocean City, NJ" && now["Ana Monroe"].bio.age === 31, "2: season_cast.props and .bio written", JSON.stringify(now["Ana Monroe"]));
  check(now["Lou Marsh"]?.props.job === "Deckhand" && now["Lou Marsh"]?.bio?.hometown === "Bristol, UK", "2: Lou joined with his details and bio");
  const log = (await pool.query("SELECT field, count(*)::int AS n FROM season_cast_changes WHERE season_id = $1 AND field IN ('props', 'bio') GROUP BY field ORDER BY field", [ids.s1])).rows;
  check(log.map((x) => `${x.field}:${x.n}`).join() === "bio:6,props:6", "2: the cast's log has each", JSON.stringify(log));

  // A second answer: Dee's job differs. We have hers now, so it's a choice, ours by default.
  r = await cast({ paste: answer({ jobs: { "Dee Kwon": "Chief stew" } }) });
  p = await page();
  const dee = p.review.changes.find((c) => c.change.k === "props" && c.change.name === "Dee Kwon");
  check(dee && dee.change.from.job === "Second stew" && dee.change.to.job === "Chief stew", "2: a different job is a change", JSON.stringify(p.review.changes.map((c) => c.change.k)));
  r = await cast({ send: true, answer: p.review.answerId, picks: {} });
  check((await rows())["Dee Kwon"].props.job === "Second stew", "2: Keep ours by default");
  // Undo of the second, then the first: back to nothing, Lou gone.
  const second = (await pool.query("SELECT id FROM admin_changes WHERE entity_id = $1 AND action = 'cast' AND undo IS NOT NULL AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1", [ids.s1])).rows[0].id;
  await desk.call("POST", `/api/desk/changes/${second}/undo`, {});
  r = await desk.call("POST", `/api/desk/changes/${firstSend}/undo`, {});
  now = await rows();
  check(r.status === 200 && !now["Lou Marsh"] && !Object.keys(now["Ana Monroe"].props).length && !now["Ana Monroe"].bio, "2: Undo puts the details and bios back", JSON.stringify({ s: r.status, b: r.body, ana: now["Ana Monroe"] }));

  // Override on Finn's page: a value not the rulebook's refused; then set, with History and Undo; a bio.
  const finn = `/api/desk/castaways/${ids.cast["Finn Bligh"]}`;
  r = await desk.call("POST", finn, { field: "props", value: { department: "Engine room" } });
  check(r.status === 400 && /Department is one of Interior, Deck, Galley, Bridge/.test(r.body.error), "2: Override refuses a value not the rulebook's", JSON.stringify(r.body));
  r = await desk.call("POST", finn, { field: "props", value: { department: "deck", job: "Bosun" } });
  check(r.status === 200 && r.body.props.department === "Deck" && r.body.props.job === "Bosun" && r.body.history.some((h) => /Details: Deck · Bosun/.test(h.text)), "2: Override sets Finn's details, History says so", JSON.stringify(r.body.props));
  const undoProps = r.body.changeId;
  r = await desk.call("POST", finn, { field: "bio", value: { hometown: "Cork, Ireland", age: "29", occupation: "Bosun", line: "" } });
  check(r.status === 200 && r.body.bio.age === 29 && r.body.history.some((h) => /Bio: Cork, Ireland · 29 · Bosun/.test(h.text)), "2: Override sets Finn's bio", JSON.stringify(r.body.bio));
  if (out) {
    const { page: b, close } = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
    try {
      await b.goto(`${process.env.BASE}/desk/season/${ids.s1}/c/${ids.cast["Finn Bligh"]}`);
      await b.locator('[data-field="props"], [data-row="props"], [data-props]').first().waitFor({ timeout: 20000 }).catch(() => {});
      await b.waitForTimeout(800);
      const words = await b.locator("body").innerText();
      check(/Department, job/.test(words) && /Deck · Bosun/.test(words) && /Cork, Ireland · 29 · Bosun/.test(words), "2: the castaway page shows their details and bio", "");
      await b.screenshot({ path: path.join(out, "2-castaway.jpg"), type: "jpeg", quality: 82 });
    } finally {
      await close();
    }
  }
  r = await desk.call("POST", `/api/desk/changes/${undoProps}/undo`, {});
  check(r.status === 200 && !Object.keys((await rows())["Finn Bligh"].props).length, "2: Undo of the Override", JSON.stringify(r.body));
}

async function part3(pool, ids) {
  // The crew's details as the desk would have them, Status added to the rulebook (as part 1 does through the editor).
  const status = { "Kip Hale": "Veteran", "Ana Monroe": "Veteran", "Dee Kwon": "Rookie", "Finn Bligh": "Veteran", "Gus Penn": "Rookie", "Rae Stone": "Veteran" };
  // Gender, every show's (the user, 2026-11-16): Rae's inferred, the others billed.
  const gender = { "Kip Hale": "Man", "Ana Monroe": "Woman", "Dee Kwon": "Woman", "Finn Bligh": "Man", "Gus Penn": "Man", "Rae Stone": "Woman" };
  await pool.query(
    `UPDATE rulebooks SET blocks = jsonb_set(blocks, '{cast,properties}', (blocks->'cast'->'properties') || '[{"key":"status","name":"Status","values":["Veteran","Rookie"],"changes":"never"}]'::jsonb)
      WHERE season_id = $1 AND owner_kind = 'season' AND NOT (blocks->'cast'->'properties' @> '[{"key":"status"}]')`,
    [ids.s1]
  );
  for (const [name, department, job, hometown, age, occupation] of CREW)
    await pool.query("UPDATE season_cast SET props = $2::jsonb, bio = $3::jsonb WHERE id = $1", [
      ids.cast[name],
      JSON.stringify({ department, job, status: status[name], gender: gender[name], genderFrom: name === "Rae Stone" ? "inferred" : "billed" }),
      JSON.stringify({ hometown, age, occupation, ...(name === "Ana Monroe" ? { line: "Runs the interior like a five-star hotel, and expects her team to keep up." } : {}) }),
    ]);
  const { rows: jo } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [U("jo")]);
  await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 0, true) ON CONFLICT DO NOTHING", [jo[0].id, ids.s1]);

  const as = await api({ user: U("jo"), pass: PASSWORD });
  const st = (await as.call("GET", `/api/seasons/${ids.s1}/stats`)).body;
  const ana = (st.cast || []).find((c) => c.name === "Ana Monroe");
  check(st.properties?.map((p) => `${p.key}${p.main ? "*" : ""}`).join() === "department,job*,status,gender", "3: the stats read carries the season's properties (job shown under a name)", JSON.stringify(st.properties));
  check(ana?.props?.job === "Chief stew" && ana?.bio?.hometown === "Ocean City, NJ" && ana?.bio?.age === 31, "3: and each person's values and bio", JSON.stringify(ana && { props: ana.props, bio: ana.bio }));

  // A game's stamp: each castaway's values by their id, and never in what's saved.
  const { stampCastProps } = jiti("../../src/lib/server/cast-props.ts");
  const S = require("../../src/lib/game/state-logic.js");
  const state = await stampCastProps({ castaways: [{ id: "k1", seasonCastId: ids.cast["Ana Monroe"] }, { id: "k2", seasonCastId: null }] }, pool);
  check(state.castProps?.k1?.job === "Chief stew" && !state.castProps.k2 && state.castPropDefs?.length === 4, "3: a game's stamp gives each castaway's values by id", JSON.stringify(state.castProps));
  const keys = new Set(S.StatsLogic.stampedKeys());
  check(!/castProp/.test(JSON.stringify(state, (k, v) => (keys.has(k) ? undefined : v))), "3: and a save leaves it out");

  if (!out) return;
  const { page, close } = await open({ user: U("jo"), pass: PASSWORD, width, height: 844 });
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.jpg`), type: "jpeg", quality: 82 });
  try {
    await page.goto(`${process.env.BASE}/show/${ids.s1}/cast`);
    await page.locator("[data-face-wall]").waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    const groups = await page.locator("[data-face-wall] [data-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-group")));
    check(groups.join() === "Interior,Deck,Galley,Bridge", "3: the wall groups by department, in the rulebook's order", groups.join());
    const lines = await page.locator("[data-face-wall] [data-cast-line]").allInnerTexts();
    check(lines.includes("Chief stew") && lines.includes("Captain"), "3: each job under a name", lines.join(" | "));
    const chips = await page.locator("[data-property-chips] [data-chip]").allInnerTexts();
    check(chips.map((c) => c.replace(/\s+/g, " ").trim()).join() === "All,Veteran 4,Rookie 2,Man 3,Woman 3", "3: one All, then the Status and Gender chips with how many", chips.join(" | "));
    check((await page.locator('[data-chips-of="department"], [data-chips-of="job"]').count()) === 0, "3: no chips for the grouping or a free-text property");
    check((await page.locator('[data-chips-of="gender"] [data-chip]').count()) === 2, "3: Gender's chips (every show's)");
    await shot("3-wall");
    await page.locator('[data-chips-of="status"] [data-chip="Rookie"]').click();
    await page.waitForTimeout(400);
    const rookies = await page.locator("[data-face-wall] [data-cast]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cast")));
    check(rookies.sort().join() === "Dee,Gus", "3: Rookie shows only the rookies", rookies.join());
    await shot("3-rookies");
    await page.locator('[data-property-chips] [data-chip=""]').click();
    await page.locator('[data-face-wall] [data-cast="Ana"]').click();
    await page.locator("[data-person-bio]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const head = await page.locator("[data-person-group]").innerText();
    const bio = await page.locator("[data-person-bio]").innerText();
    const line = await page.locator("[data-person-line]").innerText();
    check(/Interior · Chief stew · Veteran · Woman/.test(head) && bio === "Ocean City, NJ · 31 · Chief stewardess" && /five-star hotel/.test(line), "3: a face opens who they are, before any results", `${head} | ${bio} | ${line}`);
    check((await page.locator("[data-compare-with]").count()) === 0, "3: no Compare before there are numbers");
    await shot("3-sheet");
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "3: nothing wider than the screen");
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
    if (runs(2)) await part2(pool, ids);
    if (runs(3)) await part3(pool, ids);
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
