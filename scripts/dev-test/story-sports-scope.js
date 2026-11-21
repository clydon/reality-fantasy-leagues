// Dev-only: step 2.8's screenshot story (docs/PLAN-sports-ready.md, "Whose players: a game's scope"): how a sport's game scope is
// offered, on a team's sheet (src/new/sports/team.tsx: the next game, Start a game…, a rival's meetings, one game's sheet) and on
// Start a game's screens (whose players are in the game, and a pool too small for the couch caught before Start). On
// nfl-slate-fixture.js (the recorded NFL season through its stand-in ESPN, every app read pointed at it by the x-gys-sports header),
// a couch of eight (zt_nfl_ann and seven more), as zt_nfl_ann. The team sheet is opened from the slate's Players tab (its team door),
// as a person reaches it.
//   team          the Bills' sheet, its first view
//   team-ways     the same, scrolled to its ways in below the plate
//   rival         a rival picked: its meetings
//   start-season  Their season (before: Start a game…): the gallery on the Bills' season
//   draft-season  a draft (Game-night draft) on the Bills' season (before: How long moved to Regular season): whose players
//   game          one game's sheet; draft-game, a draft on it (Another game on it…): whose players
//   too-small     that draft at 10 each for a couch of eight (80: more than the Bills' players), and what Start says (after: the
//                 Start bar's warning, then too-small-shared once its fix is tapped; before: Start tapped, too-small-start)
// For each it keeps <prefix><id>.jpg and <prefix><id>.txt under --out, and prints OVERLAP lines (overlaps.js).
//
// Needs: the app (BASE, `npm run dev`), the local database and the NFL recording. Brings the fixture up and takes it down after
// unless --keep. Never beside another check on nfl-slate-fixture.js.
// Run:   node scripts/dev-test/story-sports-scope.js --prefix=before- [--out=.ui-atlas/stories/sports-scope] [--width=390 --height=844]
//        [--only=team,too-small] [--at=<ISO time; default now>] [--keep]
// The fixture runs at --at with its stand-in postseason (the recorded weeks still to play, played on), so it agrees with the app's own
// clock. Works on the sheet before step 2.8's design round (Start a game…) and after (Start a game on's rows): it says which it found.
const fs = require("fs");
const path = require("path");
const fx = require("./nfl-slate-fixture");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = args.includes("--keep");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/sports-scope"));
const PREFIX = opt("prefix", "");
const W = Number(opt("width", 390));
const H = Number(opt("height", 844));
const ONLY = opt("only", "") ? new Set(opt("only", "").split(",")) : null;
const TEAM = opt("team", "Buffalo Bills");
const AT = opt("at", new Date().toISOString());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (id) => !ONLY || ONLY.has(id);

async function frame(page, id) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}${id}.jpg`), type: "jpeg", quality: 84 });
  // The top sheet's words (a sheet scrolls inside itself: a full-page shot wouldn't hold it).
  const words = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].pop();
    return (d ?? document.body).innerText;
  });
  fs.writeFileSync(path.join(OUT, `${PREFIX}${id}.txt`), words);
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // The fixture's clock at the app's (the browser and the dev server run on the real clock): the recorded season's weeks still to play
  // played on as stand-ins, so the team's sheet and Start a game agree on which game is next.
  const w = await fx.up({ people: 8, at: AT, postseason: true });
  try {
    console.log(`slate: ${w.slate.name} (${w.seasonId}), couch ${w.couchId}`);
    const b = await open({ user: "zt_nfl_ann", pass: fx.PASSWORD, width: W, height: H, motion: "reduce", headers: { "x-gys-sports": w.espn.url } });
    const p = b.page;
    const top = () => p.locator('[role="dialog"]').last();
    const tap = async (loc) => {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click();
      await sleep(800);
    };
    const toView = async (loc, block = "start") => {
      await loc.evaluate((e, block) => e.scrollIntoView({ block }), block);
      await sleep(500);
    };
    // The team's sheet, from the slate's Players tab (its team door), as a person reaches it.
    const teamSheet = async () => {
      await p.goto(`${b.BASE}/show/${w.seasonId}/cast`, { waitUntil: "domcontentloaded", timeout: 90000 });
      const find = p.locator('input[type="search"]').first();
      await find.waitFor({ timeout: 90000 });
      await find.fill(TEAM.split(" ").pop());
      await sleep(800);
      const door = p.locator("[data-team-door]").filter({ hasText: new RegExp(TEAM.split(" ").pop(), "i") }).first();
      await door.waitFor({ timeout: 90000 });
      await tap(door);
      await top().locator("[data-team-view]").waitFor({ timeout: 45000 });
      await top().locator('[data-play="next"], [data-no-next]').first().waitFor({ timeout: 45000 });
      await sleep(900);
    };
    // Start a game… (or a rival's or a game's way in) to the gallery on what it added.
    const toGallery = async (loc) => {
      await tap(loc);
      await p.locator("[data-gallery=gallery]").waitFor({ timeout: 90000 });
      await sleep(1200);
    };
    const openBase = async (id) => {
      const sq = p.locator(`[data-gallery-base="${id}"], [data-gallery-lead="${id}"]`).first();
      await tap(sq);
      await p.locator("[data-gallery=base]").waitFor({ timeout: 30000 });
      await sleep(1000);
    };
    // The draft's size, through Your team's How many (3 to `n` each): an exclusive draft bigger than the scope's players.
    const sizeTo = async (n) => {
      await tap(p.locator('[data-gallery-row="play"]').first());
      const each = p.locator('[data-control="each"]').first();
      if (!(await each.isVisible().catch(() => false))) await tap(p.locator('[role="dialog"] button:visible').filter({ hasText: /How many/ }).first());
      await each.waitFor({ timeout: 15000 });
      const now = Number((await each.locator("b").first().innerText()).trim());
      for (let i = now; i < n; i++) await each.getByRole("button", { name: /^More/ }).click();
      await sleep(600);
      await tap(p.locator("[data-gallery-done]:visible").first());
      await p.locator("[data-gallery=base]").waitFor({ timeout: 15000 });
    };
    const startBar = async () => {
      await p.locator("[data-gallery-startbar]").first().evaluate((e) => e.scrollIntoView({ block: "end" }));
      await sleep(500);
    };
    try {
      await teamSheet();
      const scopes = (await top().locator("[data-scopes]").count()) > 0;
      console.log(scopes ? "the team's sheet has its scope rows (after)" : "the team's sheet has Start a game… (before)");
      if (want("team")) await frame(p, "team");
      if (want("team-ways")) {
        await toView(top().locator(scopes ? "[data-scopes]" : '[data-more="start"]').first(), "center");
        await frame(p, "team-ways");
      }
      if (want("rival")) {
        await tap(top().locator("[data-rival]").first());
        await toView(top().locator("[data-rivals]").first(), "center");
        await frame(p, "rival");
        await tap(top().locator("[data-rival]").first());
      }
      if (want("game") || want("draft-game")) {
        const row = top().locator("[data-game-row]").first();
        await tap(row);
        await top().locator("[data-game-view]").waitFor({ timeout: 30000 });
        if (want("game")) await frame(p, "game");
        if (want("draft-game")) {
          await toGallery(top().locator('[data-more="game-start"]').first());
          await openBase("sp-game-draft");
          await frame(p, "draft-game");
          await p.keyboard.press("Escape");
          await sleep(800);
        }
      }
      if (want("start-season") || want("draft-season") || want("too-small")) {
        await teamSheet();
        // After: Their season. Before: Start a game… (it opens on the next game; How long moved to the regular season below).
        await toGallery(top().locator(scopes ? '[data-open-row="scope-season"]' : '[data-more="start"]').first());
        if (want("start-season")) await frame(p, "start-season");
        await openBase("sp-game-draft");
        if (!scopes) {
          await tap(p.locator('[data-gallery-option="length-regular"]').first());
          await p.locator("[role=dialog] [data-gallery=base]").first().evaluate((e) => e.closest(".overflow-y-auto")?.scrollTo(0, 0));
          await sleep(600);
        }
        if (want("draft-season")) await frame(p, "draft-season");
        if (want("too-small")) {
          await sizeTo(10);
          await startBar();
          await frame(p, "too-small");
          const fix = p.locator("[data-gallery-start-fix]").first();
          if (await fix.isVisible().catch(() => false)) {
            await tap(fix);
            await startBar();
            await frame(p, "too-small-shared");
          } else {
            // Before: nothing says it until Start, and the server refuses (nothing is made: too big for the Bills' players).
            await tap(p.locator("[data-gallery-start]").first());
            await sleep(3000);
            await frame(p, "too-small-start");
          }
        }
      }
      if (b.errors.length) console.log(`ERRORS: ${b.errors.slice(0, 3).join(" | ")}`);
    } finally {
      await b.close();
    }
  } finally {
    await fx.finish(w, { keep });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
