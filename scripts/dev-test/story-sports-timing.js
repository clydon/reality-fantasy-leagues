// Dev-only: step 2.7's screenshot story (docs/PLAN-sports-ready.md, "A game through the playoffs"): a sport's game timing on Start a
// game's How long and in Game settings, before and after, at a phone's size. On nfl-slate-fixture.js (the recorded NFL season through
// its stand-in ESPN, every app read pointed at it by the x-gys-sports header), as zt_nfl_ann:
//   before   a slate of the regular season alone (stage "regular": what every league slate was before step 2.7), so How long is
//            today's: "Just Week N" and "Every game left"; and Game settings' How long of a game on it
//   after    the full slate (the regular season, then the playoffs: the default since 2.7): "Regular season" (the default) and
//            "Through the Super Bowl", each picked; and Game settings' How long of a game through the final, its Ends options
//            listed in the .txt (a native select doesn't draw open)
// For each it keeps <id>.jpg, <id>.full.jpg and <id>.txt under --out, and prints OVERLAP lines (overlaps.js).
//
// Needs: the app (BASE, `npm run dev`), the local database and the NFL recording. Brings the fixture up and takes it down after
// unless --keep. Never beside another check on nfl-slate-fixture.js.
// Run:   node scripts/dev-test/story-sports-timing.js --out=.ui-atlas/stories/sports-timing [--width=390 --height=844] [--keep]
const fs = require("fs");
const path = require("path");
const fx = require("./nfl-slate-fixture");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = args.includes("--keep");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/sports-timing"));
const W = Number(opt("width", 390));
const H = Number(opt("height", 844));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(page, id) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 84 });
  await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  const selects = await page.evaluate(() => [...document.querySelectorAll("select")].map((s) => [...s.options].map((o) => `${o.selected ? "* " : "  "}${o.textContent}`).join("\n")).join("\n---\n"));
  fs.writeFileSync(path.join(OUT, `${id}.txt`), `${await page.evaluate(() => document.body.innerText)}\n\n=== select options ===\n${selects}`);
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const w = await fx.up({});
  try {
    const { addSlate } = fx.app("../../src/lib/server/sports/find.ts");
    const { castFromEvents } = fx.app("../../src/lib/server/sports/cast.ts");
    // The before: the same league's regular season alone, its people filled as the slate's own fill does.
    const regular = await addSlate(w.users.ann.id, { league: fx.LEAGUE, slate: { stage: "regular" } }, { providers: w.providers, cast: false });
    await castFromEvents(regular.seasonId, { providers: w.providers });
    console.log(`after: ${w.slate.name} (${w.slate.stage}, ${w.slate.episodes} weeks); before: ${regular.name} (${regular.stage}, ${regular.episodes})`);
    // A game on each for Game settings: the season game, the regular one to its end, the full one through the final.
    const before = await w.start("ann", { seasonId: regular.seasonId, game: "season", tell: false });
    const after = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false, timing: "final" });
    const b = await open({ user: "zt_nfl_ann", pass: fx.PASSWORD, width: W, height: H, motion: "reduce", headers: { "x-gys-sports": w.espn.url } });
    const tap = async (sel) => {
      const el = b.page.locator(sel).first();
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click();
      await sleep(700);
    };
    const sheet = async (seasonId) => {
      await b.page.goto(`${b.BASE}/show/${seasonId}/games`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      const start = b.page.locator("[data-start-row], [data-play-start]").first();
      await start.waitFor({ timeout: 90000 });
      await start.click();
      await b.page.locator("[data-gallery=gallery]").waitFor({ timeout: 90000 });
      await sleep(800);
      await tap('[data-gallery-base="sp-league"], [data-gallery-lead="sp-league"]');
      await b.page.locator("[data-gallery=base]").waitFor({ timeout: 30000 });
      await b.page.locator("[data-gallery-length]").first().evaluate((e) => e.scrollIntoView({ block: "start" }));
      await sleep(800);
    };
    try {
      await sheet(regular.seasonId);
      await frame(b.page, "before-sheet");
      await sheet(w.seasonId);
      await frame(b.page, "after-sheet-regular");
      await tap('[data-gallery-option="length-final"]');
      await b.page.locator("[data-gallery-length]").first().evaluate((e) => e.scrollIntoView({ block: "start" }));
      await frame(b.page, "after-sheet-final");
      for (const [id, s] of [["before-settings", { seasonId: regular.seasonId, leagueId: before.leagueId }], ["after-settings", { seasonId: w.seasonId, leagueId: after.leagueId }]]) {
        await b.page.goto(`${b.BASE}/show/${s.seasonId}/backstage/settings?page=game-settings&game=${s.leagueId}&line=length`, { waitUntil: "networkidle", timeout: 90000 });
        await b.page.locator('[data-settings="span"]').first().waitFor({ timeout: 45000 });
        await b.page.locator('[data-settings="span"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
        await frame(b.page, id);
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
