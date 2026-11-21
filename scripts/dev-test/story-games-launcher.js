// Dev-only test bank: the screenshot story's frames for the Games tab as the way into games (docs/design-round/games-launcher-spec.md,
// -first-view.md, -shape.md; src/new/show/games.tsx, whats-on.tsx), real renders at a phone's size, before and after the round.
//
// Fixtures (each situation brings its own up again, and takes it down at the end unless --keep):
//   night    night-fixture.js's zt couch (ZT Survivor 51: Couch Cup, an Outlast; Lineup League; Pool Party, a survival pool; Ep 6
//            revealed, Ep 7 next week), with story-tonight-night.js's extras (a quick game that played Ep 6 for all four, a quick
//            game for Ep 7 that only riley and sam are in, trivia, bingo, casey watching only) and this file's own (`more` below): a
//            quick game for Ep 7 jordan is in, a season game on the couch jordan isn't in (Second Chance Pool, riley and alex), and a
//            game starting at Ep 9 (Merge Lineup, jordan and alex)
//   draft    draft-fixture.js's ZT Draft Night couch (zt_dr_ people): Couch Cup's snake draft 6 picks in (alex is up), Lineup
//            League's blind draft not started, and with `sport` its ZT Football season's Gridiron (15 rounds, 344 athletes)
//   short    short-games-fixture.js's busy season on new-fixture's couch: three quick games an episode for 20 episodes (about 60, all
//            but the next episode's finished: the record), the next episode's still open for alex
//   patterns story-tonight-patterns.js's games: one game of every main block the engine plays on a show, on the night couch
//
// Situations (--only=<regex on the id>):
//   week      jordan: three season games, a quick game to play and one to join for Ep 7, a season game to join, one starting later
//   watcher   casey: on the couch, plays nothing
//   busy      jordan with seven season games (night-fixture --extra=4)
//   behind    sam, two episodes behind
//   draft     alex up in Couch Cup's snake draft; Lineup League's blind draft not started
//   sport     alex on ZT Football: Gridiron mid-draft (a sport's row)
//   short     alex on the busy season: many quick games, the record and the finished games' page
//   patterns  jordan: a row for every kind of game
// For each, under --out: <id>.top.jpg (the first view), <id>.s2.jpg, <id>.s3.jpg ... (the tab a screen at a time), <id>.full.jpg,
// the situation's own frames (a sheet, the record, Tonight's next-episode block: <id>.tonight-next), the words of each in <frame>.txt, index.json, and overlaps.json (words drawn over
// words: DESIGN-PROCESS.md's rule), printed as OVERLAP lines.
//
//   the app running (BASE= from .env.local; this worktree's: http://localhost:3016)
//   node scripts/dev-test/story-games-launcher.js [--out=.ui-atlas/stories/games-launcher/after] [--before] [--only=<regex>]
//        [--width=390] [--height=844] [--keep]
// `--before` writes to .../before (today's tab: run it on the code before the round). zt_nd_ and zt_dr_ people only; every fixture
// refuses a non-local database. Shares new-fixture's couch: never beside another check that uses it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const { overlapsIn } = require("./overlaps");
const night = require("./night-fixture");
const NF = require("./new-fixture");
const DF = require("./draft-fixture");
const shortGames = require("./short-games-fixture");
const { extras } = require("./story-tonight-night");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BEFORE = args.includes("--before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/games-launcher/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const KEEP = args.includes("--keep");
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-games-launcher runs against a local database only");

// ---------- the fixtures ----------

/** The Games tab's own games on the night couch: one to play and one to join for Ep 7 (with the extras' quick7), a season game to
 *  join, one starting later. Slugged zt-nd-, so night.down takes them. */
async function more(pool) {
  await NF.moreGames(pool, [
    { slug: "zt-nd-quick7b", name: "Who goes home? Ep 7", type: "pickem", players: ["alex", "riley", "jordan", "sam"], commissioner: "alex", span: [7, 7], joinCode: "ZQUK7B" },
    { slug: "zt-nd-open", name: "Second Chance Pool", type: "pickem", players: ["alex", "riley"], commissioner: "riley", joinCode: "ZOPENP" },
    { slug: "zt-nd-later", name: "Merge Lineup", type: "active-roster", players: ["alex", "jordan"], commissioner: "alex", span: [9, 13], joinCode: "ZLATER" },
  ]);
}

async function nightUp(pool, sit) {
  const ids = await extras(pool, await night.up(pool, { phase: "watched", moves: "set", pace: "live", art: true, ...(sit.night ?? {}), ...(sit.beforeAir ? { beforeAir: (x) => sit.beforeAir(pool, x) } : {}) }));
  await more(pool);
  return { seasonId: ids.seasonId, user: NF.username(sit.who), pass: NF.PASSWORD, down: () => night.down(pool) };
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

async function shoot(p, id, note = {}) {
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

async function shootFull(p, id) {
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
  index.push({ id: `${id}.full`, height });
  console.log(`full ${id}: ${height}px`);
  return height;
}

/** The tab a screen at a time (a screen less the bars' overlap), up to `max` screens: the same frames before and after. */
async function screens(p, id, max = 4) {
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  const step = H - 200;
  for (let k = 1; k < max && k * step < height - H + 120; k++) {
    await p.evaluate((y) => window.scrollTo(0, y), k * step);
    await p.waitForTimeout(450);
    await shoot(p, `${id}.s${k + 1}`, { what: `screen ${k + 1}` });
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
}

/** Scroll so `sel`'s element sits under the compact bar (its top 70 px down). False when it isn't on the page. */
async function scrollTo(p, sel) {
  const el = p.locator(sel).first();
  if (!(await el.count())) return false;
  await el.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(450);
  return true;
}

/** Tap `sel` and shoot the sheet or page it opens, then close it (Escape). */
async function sheet(p, sel, id, what, wait = '[role="dialog"]:not([aria-hidden="true"])') {
  const el = p.locator(sel).first();
  if (!(await el.count())) return console.log(`(no ${sel} for ${id})`);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click();
  await p.locator(wait).first().waitFor({ timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(900);
  await shoot(p, id, { what });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(700);
}

async function gamesTab(session, seasonId) {
  const p = session.page;
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto(`${BASE}/show/${seasonId}/games`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-progress]").first().waitFor({ timeout: 90000 });
  await p.locator('[data-tab="games"]').first().waitFor({ timeout: 30000 }).catch(() => {});
  await fontsReady(p);
  await p.waitForTimeout(3000);
  return p;
}

// The after's own frames (selectors from games.tsx after the round); a missing one is skipped, so the list serves before too.
async function parts(p, s) {
  if (await scrollTo(p, "[data-games-quick]")) await shoot(p, `${s}.quick`, { what: "quick games" });
  if (await scrollTo(p, "[data-games-season]")) await shoot(p, `${s}.season`, { what: "your season games" });
  if (await scrollTo(p, "[data-games-join-season]")) await shoot(p, `${s}.join-season`, { what: "season games to join" });
  if (await scrollTo(p, "[data-games-record]")) await shoot(p, `${s}.record`, { what: "your record" });
}

/** Tonight's next-episode block (its one-episode games in the Games tab's rows: BACKLOG 241), the same viewer. */
async function tonightNext(p, s, fx) {
  await p.goto(`${BASE}/show/${fx.seasonId}`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-progress]").first().waitFor({ timeout: 90000 });
  await p.locator("[data-next-episode]").first().waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(2500);
  if (await scrollTo(p, "[data-next-episode]")) await shoot(p, `${s}.tonight-next`, { what: "Tonight's next episode: its one-episode games" });
}

const SITUATIONS = [
  {
    id: "week",
    who: "jordan",
    up: nightUp,
    async shots(p, s, fx) {
      await parts(p, s);
      await sheet(p, "[data-join-button], [data-join-open]", `${s}.join`, "Join's sheet");
      await sheet(p, "[data-archive-open]", `${s}.archive`, "the record: finished games", "[data-archive]");
      await tonightNext(p, s, fx);
    },
  },
  { id: "watcher", who: "casey", up: nightUp, async shots(p, s, fx) { await parts(p, s); await tonightNext(p, s, fx); } },
  { id: "busy", who: "jordan", night: { extra: 4, extraMoves: "set" }, up: nightUp, async shots(p, s) { await parts(p, s); } },
  { id: "behind", who: "sam", up: nightUp, async shots(p, s) { await parts(p, s); } },
  {
    id: "patterns",
    who: "jordan",
    // story-tonight-patterns reads its own --only (a main block) from the command line when first required: this file's --only (a
    // situation) is hidden from it, so it makes every pattern.
    beforeAir: (pool, x) => {
      const argv = process.argv;
      process.argv = argv.filter((a) => !a.startsWith("--only="));
      try {
        return require("./story-tonight-patterns").makeGames(pool, x);
      } finally {
        process.argv = argv;
      }
    },
    up: nightUp,
    // Every kind of game's row: the fold opened, the longer games a screen at a time.
    async shots(p, s) {
      await parts(p, s);
      const fold = p.locator("[data-games-fold]");
      if (await fold.count()) {
        await fold.click();
        await p.waitForTimeout(500);
      }
      if (await scrollTo(p, "[data-games-season]")) {
        const rows = await p.locator("[data-games-season] [data-game-row]").count();
        for (let k = 0; k * 9 < rows; k++) {
          await p.locator("[data-games-season] [data-game-row]").nth(k * 9).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70));
          await p.waitForTimeout(400);
          await shoot(p, `${s}.kinds-${k + 1}`, { what: `every kind's row, ${k * 9 + 1} on` });
        }
      }
    },
  },
  {
    id: "draft",
    who: "alex",
    async up(pool) {
      const ids = await DF.up(pool, { live: 6 });
      return { seasonId: ids.seasonId, user: DF.username("alex"), pass: DF.PASSWORD, down: () => DF.down(pool) };
    },
    async shots(p, s) {
      await parts(p, s);
    },
  },
  {
    id: "sport",
    who: "alex",
    async up(pool) {
      const ids = await DF.up(pool, { live: 6, sport: true });
      return { seasonId: ids.sport.seasonId, user: DF.username("alex"), pass: DF.PASSWORD, down: () => DF.down(pool) };
    },
    async shots(p, s) {
      await parts(p, s);
    },
  },
  {
    id: "short",
    who: "alex",
    async up(pool) {
      const fx = await shortGames.up(pool, { episodes: 20, through: 19, each: 3, open: true });
      return { seasonId: fx.seasonId, user: NF.username("alex"), pass: NF.PASSWORD, down: () => NF.down(pool) };
    },
    async shots(p, s) {
      await parts(p, s);
      await sheet(p, "[data-archive-open]", `${s}.archive`, "the record: finished games", "[data-archive]");
    },
  },
];

async function main() {
  const pool = new Pool({ connectionString: DB });
  let down = null;
  try {
    for (const sit of SITUATIONS) {
      if (ONLY && !new RegExp(ONLY).test(sit.id)) continue;
      if (down) await down();
      const fx = await sit.up(pool, sit);
      down = fx.down;
      const session = await open({ user: fx.user, pass: fx.pass, width: W, height: H, motion: "off" });
      try {
        const p = await gamesTab(session, fx.seasonId);
        await shoot(p, `${sit.id}.top`, { what: "first view" });
        await screens(p, sit.id, sit.max ?? 4);
        await shootFull(p, sit.id);
        await sit.shots(p, sit.id, fx);
        if (session.errors.length) console.log(`ERRORS ${sit.id}: ${session.errors.slice(0, 3).join(" | ")}`);
      } catch (e) {
        console.log(`STOPPED ${sit.id}: ${e.message.split("\n")[0]}`);
        index.push({ id: sit.id, failed: e.message.split("\n")[0] });
      }
      await session.close();
    }
  } finally {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
    if (down && !KEEP) await down();
    await pool.end();
  }
  console.log(`${index.length} frames, ${overlaps.length} overlaps → ${OUT}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
