// Dev-only test bank: the screenshot story's frames for Tonight's night (docs/design-round/tonight-night-spec.md, -first-view.md,
// -shape.md; src/new/show/night.tsx), real renders at a phone's size on night-fixture.js's zt couch (ZT Survivor 51: Couch Cup, an
// Outlast; Lineup League; Pool Party, a survival pool; jordan the viewer; Ep 6 revealed, Ep 7 next week), with the night's extras
// added by extras() below: a quick game that played Ep 6 (all four), a quick game for Ep 7 that only riley and sam are in (jordan's
// and casey's Join row), this week's trivia played by three of them, bingo cards for Ep 6, casey on the couch only watching, and
// (the `big` situation) a Weekly Lineup of nine seats, five of them computer players, with jordan in the seat that finishes last.
// For each situation, under --out:
//   <situation>.<frame>.jpg   a phone view (the section scrolled to, a card opened, a sheet), its words in <...>.txt
//   <situation>.full.jpg      the whole page (its height in index.json)
// and index.json and overlaps.json (words drawn over words: DESIGN-PROCESS.md's rule), printed as OVERLAP lines.
//
// Situations (each brings the fixture up again):
//   week      jordan, three games and the extras: the section closed, each card opened, a quick game, the extras, the next episode
//             with its Join row and the join sheet
//   watcher   casey, on the couch, plays nothing: the couch's night (bingo, trivia), the next episode's Join row; no results
//   busy      jordan with seven games (night-fixture --extra=4): three cards and the fold, then the fold opened
//   big       jordan last of nine in a Weekly Lineup: top three, the one ahead, you; See all opens the game's episode sheet
//   behind    sam, two episodes behind: the night at their own mark
//   motion    jordan, motion on: a card's change caught at three moments as it comes into view
// `--before` shoots today's page instead (run it with src/ stashed: `git stash push -- src/`): week and watcher as they were.
//
//   npm run dev   (BASE= from .env.local)
//   node scripts/dev-test/story-tonight-night.js [--out=.ui-atlas/stories/tonight-night/after] [--only=<regex>] [--width=390]
//        [--before] [--keep]
// Takes the fixture down at the end unless --keep. zt_nd_ people only; refuses a non-local database (the fixture does). Shares
// new-fixture's couch: never beside another check that uses it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const { overlapsIn } = require("./overlaps");
const night = require("./night-fixture");
const NF = require("./new-fixture");
const Bingo = require("./bingo-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { weekOf } = jiti("../../src/lib/game/trivia.ts");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BEFORE = args.includes("--before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/tonight-night/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const KEEP = args.includes("--keep");

// ---------- the fixture's extras ----------

/** The night's extras on night-fixture's couch (keyed on its zt-nd- slugs and zt_nd_ people, so night.down takes them all). */
async function extras(pool, ids, { big = false } = {}) {
  const q = async (sql, params) => (await pool.query(sql, params)).rows;
  const users = ids.users;
  const showId = (await q(`SELECT show_id FROM show_seasons WHERE id = $1`, [ids.seasonId]))[0].show_id;
  // Quick games: one that played Ep 6 (everyone), one for Ep 7 that jordan isn't in.
  await NF.moreGames(pool, [
    { slug: "zt-nd-quick6", name: "Who survives? Ep 6", type: "pickem", players: ["alex", "riley", "jordan", "sam"], commissioner: "alex", span: [6, 6], joinCode: "ZQUIK6" },
    { slug: "zt-nd-quick7", name: "Who survives? Ep 7", type: "pickem", players: ["riley", "sam"], commissioner: "riley", span: [7, 7], joinCode: "ZQUIK7" },
    ...(big ? [{ slug: "zt-nd-big", name: "Big Lineup", type: "active-roster", players: ["alex", "riley", "jordan", "sam"], commissioner: "alex", bots: 5, last: "jordan", joinCode: "ZBIGLN" }] : []),
  ]);
  // Casey on the couch, watching only, caught up through Ep 6.
  await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [ids.couchId, users.casey]);
  await pool.query(`UPDATE show_follows SET seen_through = 6 WHERE user_id = $1 AND season_id = $2`, [users.casey, ids.seasonId]);
  // This week's trivia: three of them played (scores only reach anyone else).
  for (const [who, score] of [["riley", 3], ["sam", 1], ["jordan", 2]]) {
    await pool.query(
      `INSERT INTO trivia_plays (user_id, show_id, week, round, season_id, score, questions, answers) VALUES ($1, $2, $3, '', $4, $5, 3, '{}') ON CONFLICT DO NOTHING`,
      [users[who], showId, weekOf(new Date()), ids.seasonId, score]
    );
  }
  // Bingo for Ep 6: a bank, and four cards ticked (the centre's free).
  const bank = await Bingo.up(pool, ids.seasonId, 6, { likely: 6, maybe: 6, longshot: 2 });
  const deal = (k) => [...bank.slice(k, k + 4), { key: "free", label: "Free" }, ...bank.slice(k + 4, k + 8)].map((s) => ({ key: s.key ?? s.id, label: s.label, ...(s.likelihood ? { likelihood: s.likelihood } : {}) }));
  const ticks = { riley: [0, 1, 2, 5, 7], jordan: [0, 4, 8, 3], sam: [1, 6], alex: [2, 4, 6, 0, 3] };
  for (const [k, [who, marks]] of Object.entries(ticks).entries()) {
    const card = (await q(
      `INSERT INTO bingo_cards (user_id, season_id, episode, squares, called_lines) VALUES ($1, $2, 6, $3, $4) ON CONFLICT (user_id, season_id, episode) DO UPDATE SET squares = EXCLUDED.squares RETURNING id`,
      [users[who], ids.seasonId, JSON.stringify(deal(k)), JSON.stringify(who === "riley" ? [{ line: 0, at: new Date().toISOString() }] : [])]
    ))[0];
    for (const m of marks) await pool.query(`INSERT INTO bingo_marks (card_id, square, marked_at) VALUES ($1, $2, now() - ($3 || ' minutes')::interval)`, [card.id, m, String(90 - m * 5)]);
  }
  return ids;
}

// ---------- frames ----------

const index = [];
const overlaps = [];

async function fontsReady(p) {
  const ok = await p.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded");
  }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frame would show the fallback face");
}

async function shoot(p, id, note) {
  fs.mkdirSync(OUT, { recursive: true });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 86 });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await p.evaluate(() => document.body.innerText).catch(() => ""));
  for (const h of await overlapsIn(p, H).catch(() => [])) {
    console.log(`OVERLAP ${id}: ${JSON.stringify(h)}`);
    overlaps.push({ id, words: h });
  }
  index.push({ id, ...note });
  console.log(`shot ${id}`);
}

async function shootFull(p, id, note) {
  await p.evaluate(() => {
    const st = document.createElement("style");
    st.id = "zt-full";
    st.textContent = ".nd-tabbar{display:none!important} nextjs-portal{display:none!important}";
    document.head.appendChild(st);
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(400);
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  await p.evaluate(() => document.getElementById("zt-full")?.remove());
  index.push({ id: `${id}.full`, height, ...note });
  console.log(`full ${id}: ${height}px`);
}

/** Scroll so `sel`'s element sits under the compact bar (its top 70 px down). */
async function scrollTo(p, sel) {
  await p.locator(sel).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(450);
}

const SECTION = BEFORE ? "[data-your-games]" : "[data-your-night]";

async function tonight(session, seasonId, motion = "off") {
  const p = await session.page.context().newPage();
  if (motion === "off") await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto(`${BASE}/show/${seasonId}/tonight`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-progress]").first().waitFor({ timeout: 90000 });
  await p.locator(`[data-last-time], ${SECTION}`).first().waitFor({ timeout: 30000 }).catch(() => {});
  await fontsReady(p);
  await p.waitForTimeout(2500);
  return p;
}

const SITUATIONS = [
  {
    id: "week",
    who: "jordan",
    fixture: { phase: "watched", moves: "set", pace: "live" },
    async shots(p, s) {
      await shoot(p, `${s}.top`, { what: "first view" });
      await scrollTo(p, SECTION);
      await shoot(p, `${s}.night`, { what: "the section, closed" });
      if (BEFORE) {
        await p.locator("[data-mini-ledger]").first().click();
        await p.waitForTimeout(500);
        await scrollTo(p, "[data-game-mini]:has([data-mini-ledger])");
        await shoot(p, `${s}.ledger`, { what: "today's Who scored, opened" });
        return;
      }
      for (const [kind, game] of [["lineup", "Weekly Lineup"], ["pick", "Survival Pool"], ["boots", "Outlast"]]) {
        const c = p.locator("[data-night-card]").filter({ hasText: game }).first();
        await c.locator("[data-night-toggle]").click();
        await p.waitForTimeout(500);
        await c.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
        await p.waitForTimeout(400);
        await shoot(p, `${s}.open-${kind}`, { what: `a card opened (${kind})` });
        await c.locator("[data-night-toggle]").click();
        await p.waitForTimeout(300);
      }
      await scrollTo(p, "[data-night-quick]");
      await p.locator("[data-night-quick] button[aria-expanded]").first().click();
      await p.locator("[data-night-quick] [data-night-everyone]").first().waitFor({ timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(500);
      await shoot(p, `${s}.quick`, { what: "the night's quick game, opened" });
      await scrollTo(p, "[data-night-extras]");
      await shoot(p, `${s}.extras`, { what: "the couch's bingo and trivia" });
      await scrollTo(p, "[data-next-episode]");
      await shoot(p, `${s}.next`, { what: "the next episode's block: its quick games, the Join row" });
      const join = p.locator("[data-join-row] [data-join-button]").first();
      if (await join.count()) {
        await join.click();
        await p.locator('[role="dialog"]:not([aria-hidden="true"])').first().waitFor({ timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(700);
        await shoot(p, `${s}.join`, { what: "Join's sheet" });
      }
    },
  },
  {
    id: "watcher",
    who: "casey",
    fixture: { phase: "watched", moves: "set", pace: "live" },
    async shots(p, s) {
      await shoot(p, `${s}.top`, { what: "first view" });
      const sec = BEFORE ? "[data-last-time]" : "[data-night-extras]";
      if (await p.locator(sec).count()) {
        await scrollTo(p, sec);
        await shoot(p, `${s}.night`, { what: "the couch's night" });
      }
      if (await p.locator("[data-next-episode]").count()) {
        await scrollTo(p, "[data-next-episode]");
        await shoot(p, `${s}.next`, { what: "the next episode: Join" });
      }
    },
  },
  {
    id: "busy",
    who: "jordan",
    fixture: { phase: "watched", moves: "set", pace: "live", extra: 4, extraMoves: "set" },
    async shots(p, s) {
      await scrollTo(p, SECTION);
      await shoot(p, `${s}.night`, { what: "seven games: three cards and the fold" });
      if (!BEFORE && (await p.locator("[data-night-fold]").count())) {
        await scrollTo(p, "[data-night-fold]");
        await shoot(p, `${s}.fold`, { what: "the fold" });
        await p.locator("[data-night-fold]").click();
        await p.waitForTimeout(500);
        await shoot(p, `${s}.unfolded`, { what: "the fold opened" });
      }
    },
  },
  {
    id: "big",
    who: "jordan",
    fixture: { phase: "watched", moves: "set", pace: "live" },
    big: true,
    async shots(p, s) {
      if (BEFORE) return;
      if (await p.locator("[data-night-fold]").count()) await p.locator("[data-night-fold]").click();
      const card = p.locator("[data-night-card]").filter({ hasText: "Big Lineup" }).first();
      await card.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
      await p.waitForTimeout(400);
      await shoot(p, `${s}.closed`, { what: "nine seats, closed" });
      await card.locator("[data-night-toggle]").click();
      await p.waitForTimeout(600);
      await card.locator("[data-night-well]").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 220));
      await p.waitForTimeout(400);
      await shoot(p, `${s}.open`, { what: "nine seats, opened: top three, the one ahead, you" });
      await card.locator("[data-night-all]").click();
      await p.locator('[role="dialog"]:not([aria-hidden="true"])').first().waitFor({ timeout: 10000 });
      await p.waitForTimeout(800);
      await shoot(p, `${s}.all`, { what: "See all: the game's episode sheet" });
    },
  },
  {
    id: "behind",
    who: "sam",
    fixture: { phase: "watched", moves: "set", pace: "live" },
    async shots(p, s) {
      await shoot(p, `${s}.top`, { what: "first view, behind" });
      if (await p.locator(SECTION).count()) {
        await scrollTo(p, SECTION);
        await shoot(p, `${s}.night`, { what: "the night at sam's mark" });
      }
    },
  },
  {
    id: "motion",
    who: "jordan",
    fixture: { phase: "watched", moves: "set", pace: "live" },
    motion: "on",
    async shots(p, s) {
      if (BEFORE) return;
      // The first card comes into view: caught as it starts, mid-flip and settled.
      await p.evaluate(() => window.scrollTo(0, 0));
      const el = p.locator("[data-night-card]").first();
      await el.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 300));
      for (const [wait, label, ms] of [[60, "0", 60], [270, "1", 330], [770, "2", 1100]]) {
        await p.waitForTimeout(wait);
        await p.screenshot({ path: path.join(OUT, `${s}.t${label}.jpg`), type: "jpeg", quality: 86 });
        index.push({ id: `${s}.t${label}`, what: `the change at ${ms} ms` });
        console.log(`shot ${s}.t${label}`);
      }
    },
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let session = null;
  try {
    for (const sit of SITUATIONS) {
      if (ONLY && !new RegExp(ONLY).test(sit.id)) continue;
      const ids = await extras(pool, await night.up(pool, { ...sit.fixture, art: true }), { big: !!sit.big });
      if (session) await session.close();
      session = await open({ user: NF.username(sit.who), pass: NF.PASSWORD, width: W, height: H, motion: sit.motion ?? "off" });
      const p = await tonight(session, ids.seasonId, sit.motion ?? "off");
      try {
        await sit.shots(p, sit.id);
        if (sit.id !== "motion") await shootFull(p, sit.id, { situation: sit.id });
      } catch (e) {
        console.log(`STOPPED ${sit.id}: ${e.message.split("\n")[0]}`);
        index.push({ id: sit.id, failed: e.message.split("\n")[0] });
      }
      await p.close();
    }
  } finally {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
    if (session) await session.close();
    if (!KEEP) await night.down(pool);
    await pool.end();
  }
  console.log(`${index.length} frames, ${overlaps.length} overlaps → ${OUT}`);
}

module.exports = { extras };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
