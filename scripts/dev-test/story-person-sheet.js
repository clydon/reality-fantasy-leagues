// Dev-only test bank: a castaway's sheet, reached every way the app opens it, and the doors on it, for the person-sheet round's
// screenshot story (docs/design-round/drill-person-sheet-spec.md). The same castaway (--name, default Jelly), as alex on
// new-fixture.js's couch (Survivor 51's real castaways and photos, the couch's demo names), from:
//   cast-sheet        the Cast tab's face wall, a tap on their face
//   game-sheet        the Weekly Lineup game page, a tap on them in Your team (or in Everyone in this game when alex doesn't hold them)
//   cast-in-game      the Cast tab's sheet, then In your games › Weekly Lineup (before the round: a second sheet; after: the row
//                     opens in place to its holders)
//   outlast-sheet     the Outlast game page (an exclusive draft), a tap on them
//   sam-sheet         the Cast tab as sam, two episodes behind (every count stops at sam's mark)
//   riley-traitors    the Traitors' Cast tab as riley, who only watches it (no game): a face's sheet
// and the round's doors (each skipped with a SKIP line on a build without them):
//   lens-game         the Cast tab's sheet, Counted by switched to Weekly Lineup in place
//   holder-person     an In your games row opened, then a holder: that person's sheet in that game, the path back on top
//   stat-level        the Cast tab's sheet, a tap on one of their numbers (--stat, else the first): everyone ranked on it
//   stat-person       from the board, a tap on someone else: their sheet over it, the path back on top
//   stat-back         the phone's back: the board again
//   game-stat-level   the game page's sheet, a tap on one of their numbers: the same board in the game's lens (who holds each)
//   chart-episode     the sheet's chart, a tap on an episode's column (--ep, default 2): their story at that episode
//   compare-pick / compare-versus   Compare with…: the face wall in a sheet, then the two side by side
//   stats-card        Tonight's Stats card, a tap on a row: that castaway's sheet over Tonight
//   real-cast-sheet / real-stat-level / real-stat-person   (--real-db) the sheet, a stat's board and someone on it, on the real
//                     Survivor 51 in another local database (a production copy: the cast-props lane's rfl_castprops has its billed
//                     bios, properties and holdings), as zt_ps_viewer, made there for the run (following the season, no game, no
//                     couch: no real person's data on screen) and deleted after. The dev server must be reading that database too
//                     (AUTH_DATABASE_URL pointed at it); only these frames are shot then.
// Each frame is the first phone view (<id>.jpg), the whole sheet when it scrolls (<id>.full.jpg: the sheet laid out at its full
// height), its words (<id>.txt), and an overlap report (OVERLAP lines, overlaps.json: DESIGN-PROCESS.md, "No words over words").
// The fixture's people are zt_nd_ usernames, which a face draws its initial from (every face would read Z), so the page is shown
// its reads without the prefix, as a couch's own names would be (story-numbers.js's way); nothing in the database changes for it.
// A page error is printed as a PAGEERROR line.
//
//   node scripts/dev-test/story-person-sheet.js [--out=.ui-atlas/stories/person-sheet/after] [--width=390 --height=844]
//                                               [--name=Jelly] [--stat=<stat key or words>] [--ep=2] [--only=<regex on frame id>]
//                                               [--up] [--down] [--dress-from=<database>]
//   node scripts/dev-test/story-person-sheet.js --real-db=<database> [--real-show=survivor --real-season=51] [--real-name=Sharonda]
//                                               [--real-ep=<n>] [--stat=...] [--out=...] [--only=<regex>]
//                                               [--region=<selectors>]  (also <id>.region.jpg: that part of the sheet)
//                                               [--click=<selector>]  (tapped in the top sheet before each shot)
//                                               [--stretch=<n>]  (the season's stats stretched to n episodes: made up, for layout)
//                                               [--amount=<a moment's name>]  (an amount added to the season's stats: made up)
//                                               [--dump-stats=<file> [--dump-only]]
//   --dump-stats=<file>   also writes the real season's /api/seasons/<id>/stats as the viewer reads it (e.g. to try a chart rule
//           on real numbers); --dump-only writes it and shoots nothing. Keep it out of the repo
//           (the scratchpad or .ui-atlas/): it is a production copy's data.
//   --up    brings new-fixture.js up first (refreshing it), dressed in the show's art;  --down  takes it down at the end.
//   --side-game   for the run, a game on the couch alex doesn't play (new-fixture.js sideGame: riley, jordan and sam's Side
//           Lineup), so the castaway sheet's In the couch's games has one that isn't yours; taken away at the end.
//   --dress-from=<database>   for the run, the fixture's cast takes the real Survivor 51's billed bios and properties from that
//           local database (by name: the fixture's castaways are Survivor 51's), and its holding facts up to the fixture's
//           episode 5; put back as they were at the end.
//
// Needs the dev server (npm run dev; BASE= for another). Touches only new-fixture.js's zt-nd rows and zt_ people (zt_ps_viewer in
// --real-db's database); refuses a non-local database. Never run it beside another check on new-fixture.js.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/person-sheet/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const NAME = opt("name", "Jelly");
const STAT = opt("stat", null);
const EP = Number(opt("ep", 2));
const ONLY = opt("only", null);
const BASE = process.env.BASE || "http://localhost:3000";
const PASS = "zt-pass-12345";
const OVERLAPS = [];

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-person-sheet runs against a local database only");
/** Another database on the same local server, by name (the URL's last path part swapped). */
const dbNamed = (name) => DB.replace(/\/([^/?]+)(\?.*)?$/, (m, d, q) => `/${name}${q ?? ""}`);
const DRESS = opt("dress-from", null);
const REAL_DB = opt("real-db", null);
const REAL_NAME = opt("real-name", "Sharonda");
const CURSOR = 5; // new-fixture.js's results run through episode 5
// The real season: --real-show (a show's slug, default survivor) and --real-season (its number, default 51).
const REAL_SHOW = opt("real-show", "survivor");
const REAL_SEASON = Number(opt("real-season", 51));
const realSeason = async (pool) => (await pool.query(`SELECT ss.id, (SELECT max(episode_number) FROM season_decisions d WHERE d.season_id = ss.id AND d.status = 'accepted') AS ep FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = $1 AND ss.season_number = $2`, [REAL_SHOW, REAL_SEASON])).rows[0] ?? null;

const wait = (p, ms) => p.waitForTimeout(ms);
const top = (p) => p.locator('[role="dialog"]').last();
const sheetOpen = async (p) => { await top(p).waitFor({ timeout: 12000 }); await wait(p, 850); };
const click = async (p, l) => { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click(); await wait(p, 900); };

/** The frame: the first view, the words, the overlaps; then the top sheet laid out whole (when it scrolls). */
async function shoot(p, id) {
  const base = path.join(OUT, id);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await wait(p, 500);
  // --click=<selector>: tap that in the top sheet first (a fold opened, say), for every frame of the run.
  const tap = opt("click", null);
  if (tap) {
    const el = top(p).locator(tap).first();
    if (await el.count()) await click(p, el);
  }
  const face = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!face) throw new Error("Archivo never loaded (is the dev server mid-recompile?)");
  const hits = await overlapsIn(p, H).catch(() => []);
  OVERLAPS.push({ frame: id, hits });
  for (const h of hits) console.log(`OVERLAP ${id}: "${h[0]}" over "${h[1]}"`);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 84 });
  const words = (await top(p).count()) ? await top(p).innerText() : await p.evaluate(() => document.body.innerText);
  fs.writeFileSync(base + ".txt", words);
  // The whole sheet: its scroller let out to its full height in a viewport tall enough, then clipped to the sheet.
  const tall = await p.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const sc = d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY));
    return d && sc && sc.scrollHeight > sc.clientHeight + 4 ? d.getBoundingClientRect().height + (sc.scrollHeight - sc.clientHeight) : 0;
  });
  if (tall) {
    const at = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].at(-1); const sc = d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)); return sc ? sc.scrollTop : 0; });
    await p.setViewportSize({ width: W, height: Math.ceil(tall) + 80 });
    const style = await p.addStyleTag({ content: '[role="dialog"]{max-height:none!important} [role="dialog"] .overflow-y-auto{overflow:visible!important}' });
    await wait(p, 600);
    const box = await top(p).boundingBox();
    if (box) await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 80, clip: { x: 0, y: Math.max(0, box.y), width: W, height: Math.ceil(box.height) } });
    await shootRegion(p, base);
    await style.evaluate((e) => e.remove());
    await p.setViewportSize({ width: W, height: H });
    await wait(p, 400);
    // Back where it was (a frame after this one continues from here).
    await p.evaluate((y) => { const d = [...document.querySelectorAll('[role="dialog"]')].at(-1); const sc = d && [...d.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY)); if (sc) sc.scrollTop = y; }, at);
  } else await shootRegion(p, base);
  console.log(`SHOT ${id}${tall ? " (+ whole sheet)" : ""}`);
}

/** --region=<selectors>: one part of the top sheet as well (<id>.region.jpg), from the top of the first match to the bottom of the
 *  last, e.g. "[data-cast-chart],[data-their-numbers]" for the chart through the numbers; laid out whole when the sheet scrolls. */
async function shootRegion(p, base) {
  const sel = opt("region", null);
  if (!sel) return;
  const r = await p.evaluate((s) => {
    const d = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const bs = d ? [...d.querySelectorAll(s)].map((e) => e.getBoundingClientRect()).filter((b) => b.height > 0) : [];
    return bs.length ? { y: Math.min(...bs.map((b) => b.top)), b: Math.max(...bs.map((b) => b.bottom)) } : null;
  }, sel);
  if (r) await p.screenshot({ path: base + ".region.jpg", type: "jpeg", quality: 86, clip: { x: 0, y: Math.max(0, r.y - 14), width: W, height: Math.ceil(r.b - r.y + 28) } });
}

async function ids(pool) {
  const q = async (sql, v) => (await pool.query(sql, v)).rows;
  const season = (await q(`SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = 'zt-nd-survivor' AND ss.season_number = 51`))[0]?.id;
  const traitors = (await q(`SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = 'zt-nd-traitors' ORDER BY ss.season_number DESC LIMIT 1`))[0]?.id ?? null;
  const leagues = Object.fromEntries((await q(`SELECT id, slug FROM leagues WHERE slug IN ('zt-nd-lineup','zt-nd-outlast','zt-nd-pool') AND deleted_at IS NULL`)).map((r) => [r.slug.replace("zt-nd-", ""), r.id]));
  if (!season || !leagues.lineup) throw new Error("new-fixture.js's couch isn't there: run with --up");
  return { season, traitors, ...leagues };
}

/**
 * --stretch=<n>: this phone reads the season's stats as if it had run <n> episodes, a made-up season for layout (Big Brother's
 * and Survivor Australia's run to 30): each episode past the real ones draws moments (seeded, the same every run) at each kind's
 * rate so far, and the cast leaves one at a time until three remain, the castaway named by --name / --real-name among them.
 * Nothing in the database changes; label frames from it as made up.
 */
const STRETCH = Number(opt("stretch", 0));
function stretched(d, n, keep) {
  if (!n || !d || !Array.isArray(d.cast) || !(d.through > 0) || d.through >= n) return d;
  const eps = d.through;
  const seen = d.cast.reduce((t, c) => t + Math.min(eps, c.out ?? eps), 0) || 1;
  const rate = new Map();
  for (const c of d.cast) for (const [, k] of c.events) rate.set(k, (rate.get(k) ?? 0) + 1);
  let seed = 51;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stay = d.cast.filter((c) => c.out === null);
  const kept = stay.find((c) => c.first === keep || c.name.startsWith(keep));
  const leaving = stay.filter((c) => c !== kept).slice(0, Math.max(0, stay.length - 3));
  leaving.forEach((c, i) => {
    c.out = eps + Math.round(((i + 1) * (n - eps)) / (leaving.length + 1));
    c.how = null;
  });
  for (const c of d.cast) {
    for (let ep = eps + 1; ep <= (c.out ?? n); ep++) for (const [k, v] of rate) if (rnd() < v / seen) c.events.push([ep, k, 0, 1]);
    c.counts = {};
    for (const [, k, , u] of c.events) c.counts[k] = (c.counts[k] ?? 0) + (u ?? 1);
    c.perEp = Array.from({ length: n }, (_, i) => (c.out !== null && i + 1 > c.out ? null : 0));
  }
  d.through = n;
  if ("seenThrough" in d) d.seenThrough = n;
  return d;
}

/**
 * --amount=<name>: this phone reads the season's stats with an amount added, a moment a rulebook asks for as a number (Below Deck's
 * "Individual charter gratuity share", a judge's score): made up, for layout, since the seasons on hand have none. Everyone still in
 * gets one each episode (seeded, the same every run, 400 to 2,600 in fifties). Label frames from it as made up.
 */
const AMOUNT = opt("amount", null);
function withAmount(d, name) {
  if (!name || !d || !Array.isArray(d.cast) || !(d.through > 0)) return d;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  d.stats.push({ key: "ztAmount", name, unit: "", points: 0.01, amount: true });
  for (const c of d.cast) {
    for (let ep = 1; ep <= (c.out ?? d.through); ep++) c.events.push([ep, "ztAmount", 0, Math.round((400 + rnd() * 2200) / 50) * 50]);
    c.counts.ztAmount = c.events.filter((e) => e[1] === "ztAmount").reduce((t, e) => t + e[3], 0);
  }
  return d;
}

/** A signed-in phone, its reads shown without the fixture's prefix, its page errors printed (and --key-variant, --stretch). */
async function phone(user) {
  const b = await open({ user, pass: PASS, width: W, height: H, motion: "reduce" });
  b.page.on("pageerror", (e) => console.log(`PAGEERROR ${user}: ${e.message.split("\n")[0]}`));
  await b.page.route("**/api/**", async (route) => {
    const res = await route.fetch().catch(() => null);
    if (!res) return route.abort();
    if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
    let body = await res.text();
    if (STRETCH && /\/api\/seasons\/[^/]+\/stats(\?|$)/.test(route.request().url())) body = JSON.stringify(stretched(JSON.parse(body), STRETCH, REAL_DB ? REAL_NAME : NAME));
    if (AMOUNT && /\/api\/seasons\/[^/]+\/stats(\?|$)/.test(route.request().url())) body = JSON.stringify(withAmount(JSON.parse(body), AMOUNT));
    return route.fulfill({ response: res, body: body.replace(/"zt_nd_([a-z]+)"/g, '"$1"') });
  });
  return b;
}

/** The castaway's sheet from the Cast tab's face wall (`who`: a first name, else the wall's first face). */
async function castSheet(p, season, who = NAME) {
  await p.goto(`${BASE}/show/${season}/cast`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-face-wall]").first().waitFor({ timeout: 45000 });
  await wait(p, 1200);
  await click(p, p.locator(who ? `[data-face-wall] button[data-cast="${who}"]` : "[data-face-wall] button").first());
  await sheetOpen(p);
}

/** The castaway's sheet from a game page: Your team when they're on it, else Everyone in this game. */
async function gameSheet(p, x, league) {
  await p.goto(`${BASE}/show/${x.season}/game/${league}`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
  await wait(p, 1500);
  const door = p.locator(`[data-door-cast]:has-text("${NAME}")`).first();
  if (await door.count()) {
    await click(p, door);
  } else {
    const all = p.locator("[data-door-table], button:has-text('Everyone in this game')").first();
    if (!(await all.count())) return false;
    await click(p, all);
    await sheetOpen(p);
    await click(p, top(p).locator(`[data-door-cast]:has-text("${NAME}")`).first());
  }
  await sheetOpen(p);
  return true;
}

/** A tap on one of the sheet's numbers, the one asked for or the first. */
async function statDoor(p) {
  let doors = top(p).locator("[data-stat-door]");
  // The scored sheet (TEMP "score"): a numbers row opens in place first, the board's door inside it.
  if (!(await doors.count())) {
    const rows = top(p).locator("[data-stat-open]");
    if (!(await rows.count())) return false;
    let row = rows.first();
    if (STAT) {
      const want = top(p).locator(`[data-stat-open="${STAT}"], [data-stat-open]:has-text("${STAT}")`).first();
      if (await want.count()) row = want;
    }
    await click(p, row);
    doors = top(p).locator("[data-stat-door]");
    if (!(await doors.count())) return false;
  }
  let door = doors.first();
  if (STAT) {
    const want = top(p).locator(`[data-stat-door="${STAT}"], [data-stat-door]:has-text("${STAT}")`).first();
    if (await want.count()) door = want;
  }
  await click(p, door);
  await sheetOpen(p);
  return true;
}

/** For the run, the fixture's cast takes the real Survivor 51's billed bios and properties (by name) and its holding facts up to the
 *  fixture's last episode, from another local database; the returned function puts everything back as it was. */
async function dress(pool, x) {
  const src = new Pool({ connectionString: dbNamed(DRESS) });
  const put = [];
  try {
    const real = await realSeason(src);
    if (!real) throw new Error(`no Survivor 51 in ${DRESS}`);
    const was = (await pool.query(`SELECT id, props, bio FROM season_cast WHERE season_id = $1`, [x.season])).rows;
    const names = new Set((await pool.query(`SELECT lower(name) AS n FROM season_cast WHERE season_id = $1`, [x.season])).rows.map((r) => r.n));
    for (const c of (await src.query(`SELECT name, props, bio FROM season_cast WHERE season_id = $1`, [real.id])).rows) {
      await pool.query(`UPDATE season_cast SET props = $1, bio = $2 WHERE season_id = $3 AND lower(name) = lower($4)`, [c.props, c.bio, x.season, c.name]);
    }
    const holds = (await src.query(`SELECT episode_number, post_merge, castaway_name, method, event_type FROM season_decisions WHERE season_id = $1 AND status = 'accepted' AND kind = 'holding' AND episode_number <= $2 ORDER BY episode_number, created_at`, [real.id, CURSOR])).rows;
    for (const h of holds.filter((h) => names.has(h.castaway_name.toLowerCase()) && (!h.method || names.has(h.method.toLowerCase())))) {
      const r = await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, post_merge, kind, castaway_name, method, event_type, status, decided_at) VALUES ($1, $2, $3, 'holding', $4, $5, $6, 'accepted', now()) RETURNING id`,
        [x.season, h.episode_number, h.post_merge, h.castaway_name, h.method, h.event_type]
      );
      put.push(r.rows[0].id);
    }
    console.log(`[dress] ${was.length} cast given ${DRESS}'s bios and properties; ${put.length} holding facts through Ep ${CURSOR}`);
    return async () => {
      for (const c of was) await pool.query(`UPDATE season_cast SET props = $1, bio = $2 WHERE id = $3`, [c.props, c.bio, c.id]);
      if (put.length) await pool.query(`DELETE FROM season_decisions WHERE id = ANY($1::uuid[])`, [put]);
      console.log("[dress] put back");
    };
  } finally {
    await src.end();
  }
}

/** The real frames: a throwaway viewer in --real-db's database following the real Survivor 51 at --real-ep (else its latest
 *  result), its sheet, a stat's board and someone on it; the viewer deleted after (its follow and sessions go with it). */
async function realFrames(phones) {
  const pool = new Pool({ connectionString: dbNamed(REAL_DB) });
  const id = () => Array.from(require("crypto").randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  const uid = id();
  try {
    const real = await realSeason(pool);
    if (!real?.ep) throw new Error(`no ${REAL_SHOW} season ${REAL_SEASON} results in ${REAL_DB}`);
    const at = Number(opt("real-ep", real.ep));
    await pool.query(`DELETE FROM "user" WHERE username = 'zt_ps_viewer'`);
    const { hashPassword } = await import("better-auth/crypto");
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, 'zt_ps_viewer', 'zt_ps_viewer@example.invalid', true, 'zt_ps_viewer', 'zt_ps_viewer', now(), now())`, [uid]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [id(), uid, await hashPassword(PASS)]);
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, $3, true)`, [uid, real.id, at]);
    console.log(`[real] zt_ps_viewer follows ${REAL_DB}'s ${REAL_SHOW} ${REAL_SEASON} through Ep ${at}`);
    const v = await phone("zt_ps_viewer");
    phones.push(v);
    const p = v.page;
    const shot = async (frame, fn) => {
      if (ONLY && !new RegExp(ONLY).test(frame)) return;
      try {
        if ((await fn()) === false) console.log(`SKIP ${frame}: not on this build`);
        else await shoot(p, frame);
      } catch (e) {
        console.log(`FAIL ${frame}: ${e.message.split("\n")[0]}`);
      }
    };
    const dump = opt("dump-stats", null);
    if (dump) {
      if (!p.url().startsWith(BASE)) await p.goto(BASE, { waitUntil: "domcontentloaded" });
      const json = await p.evaluate(async (u) => (await fetch(u)).json(), `/api/seasons/${real.id}/stats`);
      fs.writeFileSync(path.resolve(dump), JSON.stringify(json));
      console.log(`[real] the season's stats through Ep ${at} written to ${dump}`);
      if (has("dump-only")) return;
    }
    await shot("real-cast-sheet", () => castSheet(p, real.id, REAL_NAME));
    await shot("real-stat-level", () => statDoor(p));
    await shot("real-stat-person", async () => {
      const rows = top(p).locator(`button[data-stat-row]:not([data-stat-row="${REAL_NAME}"])`);
      if (!(await rows.count())) return false;
      await click(p, rows.first());
      await sheetOpen(p);
    });
  } finally {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [uid]).catch(() => {});
    await pool.end();
    console.log("[real] zt_ps_viewer deleted");
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const phones = [];
  if (REAL_DB) {
    try {
      await realFrames(phones);
      fs.writeFileSync(path.join(OUT, "overlaps-real.json"), JSON.stringify(OVERLAPS, null, 2));
    } finally {
      for (const b of phones) await b.close().catch(() => {});
    }
    return;
  }
  const pool = new Pool({ connectionString: DB });
  let undress = null;
  try {
    if (has("up")) await require("./new-fixture").up(pool, { art: true });
    // The couch's faces in set colours (a face nobody chose takes one from its id, and --up makes new ids, so frames from two runs
    // came out in different colours: once all four Ember). The fixture's own rows; new-fixture.js --down takes them with the people.
    const FACES = { zt_nd_alex: "#5089c9", zt_nd_riley: "#e86f9a", zt_nd_jordan: "#8db85e", zt_nd_sam: "#f2804b", zt_nd_casey: "#a76bb0" };
    for (const [u, colour] of Object.entries(FACES)) {
      await pool.query(`INSERT INTO user_settings (user_id, colour) SELECT id, $2 FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO UPDATE SET colour = EXCLUDED.colour`, [u, colour]);
    }
    const x = await ids(pool);
    if (DRESS) undress = await dress(pool, x);
    if (has("side-game")) console.log(`[side] Side Lineup on the couch, alex not in it: ${await require("./new-fixture").sideGame(pool)}`);
    const want = (id) => !ONLY || new RegExp(ONLY).test(id);
    const alex = await phone("zt_nd_alex");
    phones.push(alex);
    const p = alex.page;
    const run = async (id, fn, page = p) => {
      if (!want(id)) return;
      try {
        const ok = await fn();
        if (ok === false) console.log(`SKIP ${id}: not on this build`);
        else await shoot(page, id);
      } catch (e) {
        console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
      }
    };

    await run("cast-sheet", () => castSheet(p, x.season));
    await run("game-sheet", () => gameSheet(p, x, x.lineup));
    await run("cast-in-game", async () => {
      await castSheet(p, x.season);
      const g = top(p).locator(`[data-person-game="${x.lineup}"] button, [data-person-game="${x.lineup}"]`).first();
      if (!(await g.count())) return false;
      await click(p, g);
      await wait(p, 300);
      if (await p.locator('[role="dialog"]').count()) await sheetOpen(p);
    });
    await run("holder-person", async () => {
      const h = top(p).locator("[data-game-holders] [data-door-person]").first();
      if (!(await h.count())) return false;
      await click(p, h);
      await sheetOpen(p);
    });
    await run("outlast-sheet", () => gameSheet(p, x, x.outlast));
    await run("lens-game", async () => {
      await castSheet(p, x.season);
      const l = top(p).locator(`[data-lens-option="${x.lineup}"]`).first();
      if (!(await l.count())) return false;
      await click(p, l);
    });
    await run("stat-level", async () => {
      await castSheet(p, x.season);
      return statDoor(p);
    });
    await run("stat-person", async () => {
      const rows = top(p).locator(`button[data-stat-row]:not([data-stat-row="${NAME}"])`);
      if (!(await rows.count())) return false;
      await click(p, rows.first());
      await sheetOpen(p);
    });
    await run("stat-back", async () => {
      if (!(await p.locator("[data-stat-board]").count())) return false;
      await p.goBack();
      await wait(p, 1200);
    });
    await run("game-stat-level", async () => {
      if (!(await gameSheet(p, x, x.lineup))) return false;
      return statDoor(p);
    });
    if (want("chart-episode")) {
      // On a phone with motion on, shot while the story's episode still holds its fill (it fades over 1.6 s).
      const m = await open({ user: "zt_nd_alex", pass: PASS, width: W, height: H, motion: "on" });
      phones.push(m);
      try {
        await castSheet(m.page, x.season);
        const ep = top(m.page).locator(`[data-chart-episode="${EP}"]`);
        if (!(await ep.count())) console.log("SKIP chart-episode: not on this build");
        else {
          await m.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
          await ep.first().click();
          await wait(m.page, 420);
          await m.page.screenshot({ path: path.join(OUT, "chart-episode.jpg"), type: "jpeg", quality: 84 });
          fs.writeFileSync(path.join(OUT, "chart-episode.txt"), await top(m.page).innerText());
          console.log("SHOT chart-episode (motion on)");
        }
      } catch (e) {
        console.log(`FAIL chart-episode: ${e.message.split("\n")[0]}`);
      }
    }
    await run("compare-pick", async () => {
      await castSheet(p, x.season);
      const c = top(p).locator("[data-compare-with]");
      if (!(await c.count())) return false;
      await click(p, c);
      await sheetOpen(p);
      if (!(await top(p).locator("[data-compare-pick]").count())) return false;
    });
    await run("compare-versus", async () => {
      const face = top(p).locator(`[data-compare-pick] button[data-cast]:not([data-cast="${NAME}"])`).first();
      if (!(await face.count())) return false;
      await click(p, face);
      await sheetOpen(p);
    });
    await run("stats-card", async () => {
      await p.goto(`${BASE}/show/${x.season}/tonight`, { waitUntil: "domcontentloaded" });
      await p.locator("[data-stats-card]").first().waitFor({ timeout: 45000 });
      await wait(p, 1200);
      const row = p.locator("[data-stats-card] button[data-board-row]").first();
      if (!(await row.count())) return false;
      await click(p, row);
      await sheetOpen(p);
    });
    if (want("sam-sheet")) {
      const sam = await phone("zt_nd_sam");
      phones.push(sam);
      await run("sam-sheet", () => castSheet(sam.page, x.season), sam.page);
    }
    if (want("riley-traitors") && x.traitors) {
      const riley = await phone("zt_nd_riley");
      phones.push(riley);
      await run("riley-traitors", () => castSheet(riley.page, x.traitors, null), riley.page);
    }
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
  } finally {
    for (const b of phones) await b.close().catch(() => {});
    if (undress) await undress().catch((e) => console.log(`[dress] couldn't put back: ${e.message}`));
    if (has("side-game")) await require("./new-fixture").sideGame(pool, false).catch((e) => console.log(`[side] couldn't take away: ${e.message}`));
    if (has("down")) await require("./new-fixture").down(pool).catch(() => {});
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
