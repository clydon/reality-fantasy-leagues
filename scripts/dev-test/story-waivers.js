// Dev-only test bank: the new design's Waivers page through a waiver week, for a design round's screenshot story (step 8).
// For each phase it brings waivers-fixture.js up on the new design (--ui=new: its season followed, its people opening on the new
// design), then shoots /show/<season>/waivers at --width as each person, in each of the fixture's two games (Classic, exclusive;
// Roster, shared), with the page's words and an overlap report beside each frame:
//   sam   (zt_wplayer)  owed a replacement for Jelly: the page, its claim picker (Replace), and claims saved (phase claimed)
//   kim   (zt_wcomm)    the commissioner: the page with its tools
//   josie (zt_wlate)    hasn't revealed: the gated page
// and, from phase processed on, the run's beats (Tonight's "Waivers ran" opens them) and the past week.
//
//   node scripts/dev-test/story-waivers.js [--out=.ui-atlas/stories/step8-waivers/before] [--phases=open,claimed,processed,idle]
//                                          [--width=390 --height=844] [--who=sam,kim,josie] [--keep]
//
// Needs the dev server (npm run dev). Takes the fixture down at the end unless --keep. Touches only waivers-fixture.js's zt-wv-
// rows and zt_w people; refuses a non-local database. Never run beside another check on the waivers fixture.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fixture = require("./waivers-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/step8-waivers/before"));
const PHASES = opt("phases", "open,claimed,processed,idle").split(",");
const WHO = opt("who", "sam,kim,josie").split(",");
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const USER = { sam: "zt_wplayer", kim: "zt_wcomm", josie: "zt_wlate" };
const PASS = "zt-pass-12345";

async function shoot(page, id, { full = true } = {}) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 82 });
  if (full) await page.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await page.evaluate(() => document.body.innerText));
  const over = await overlapsIn(page).catch(() => []);
  for (const o of over) console.log(`OVERLAP ${id}: ${JSON.stringify(o)}`);
  console.log(`shot ${id}`);
}

const tapText = async (page, text) => {
  const l = page.locator(`:is(button,a,[role=button]):has-text("${text}")`).first();
  if (!(await l.count())) return false;
  await l.click();
  await page.waitForTimeout(900);
  return true;
};

(async () => {
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-waivers runs against a local database only");
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const errors = [];
  try {
    for (const phase of PHASES) {
      await fixture.up(pool, [`--phase=${phase}`, "--ui=new"]);
      const { rows } = await pool.query(`SELECT id FROM show_seasons WHERE name = 'zt-waivers' ORDER BY season_number DESC LIMIT 1`);
      const season = rows[0].id;
      for (const who of WHO) {
        const { page, close } = await open({ user: USER[who], pass: PASS, width: W, height: H });
        page.on("pageerror", (e) => errors.push(`${phase} ${who}: ${e.message}`));
        try {
          for (const game of ["classic", "roster"]) {
            await page.goto(`${process.env.BASE || "http://localhost:3000"}/show/${season}/waivers`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1500);
            // The page's game switch (its second game: the fixture's Roster league).
            if (game === "roster") { await page.locator("[data-wv-game]").nth(1).click().catch(() => {}); await page.waitForTimeout(1200); }
            await shoot(page, `${phase}-${game}-${who}`);
            // The claim picker: the foot's Swap (the open spot's own), else a row's.
            const swap = (await page.locator("[data-wv-plate] [data-swap]").count()) ? page.locator("[data-wv-plate] [data-swap]").first() : page.getByRole("button", { name: "Swap", exact: true }).last();
            if (who === "sam" && phase === "open" && (await swap.count())) {
              await swap.click();
              await page.waitForTimeout(1100);
              await shoot(page, `${phase}-${game}-${who}-picker`, { full: false });
              await page.keyboard.press("Escape");
            }
          }
          if (who === "sam" && (phase === "processed" || phase === "idle")) {
            await page.goto(`${process.env.BASE || "http://localhost:3000"}/show/${season}/tonight`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1500);
            await shoot(page, `${phase}-tonight-${who}`, { full: false });
            if (await tapText(page, "Waivers ran")) await shoot(page, `${phase}-run-${who}`, { full: false });
          }
        } finally {
          await close();
        }
      }
    }
  } finally {
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  for (const e of errors) console.log(`PAGE ERROR ${e}`);
  console.log(`frames in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
