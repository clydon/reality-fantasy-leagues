// THROWAWAY (critique A): screenshots of the Start a game sheet at 390. Delete when done.
require("dotenv").config({ path: ".env.local", quiet: true });
const { open, BASE } = require("./browser");
const { Pool } = require("pg");
const OUT = "C:/Users/conor/AppData/Local/Temp/claude/c--Users-conor-reality-fantasy-leagues/226be955-51d6-4561-8042-d709f6e95a79/scratchpad/critA/";
const fs = require("fs");
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows } = await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id=ss.show_id WHERE s.slug='zt-nd-survivor' AND ss.season_number=51");
  await pool.end();
  const sid = rows[0].id;
  const { page, close } = await open({ user: "zt_nd_jordan", pass: "zt-pass-12345", width: 390, height: 844, motion: "off" });
  const shot = async (n) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + n + ".png" });
  };
  const body = () => page.locator("[role=dialog][data-open] [data-start-sheet]").first();
  const scrollSheet = async (y) => {
    await page.evaluate((y) => {
      const el = document.querySelector("[role=dialog][data-open] [data-start-sheet]");
      let s = el;
      while (s && s.scrollHeight <= s.clientHeight + 2) s = s.parentElement;
      if (s) s.scrollTop = y;
    }, y);
  };
  const back = async () => {
    await page.locator("[role=dialog][data-open] [data-sheet-back]").first().click();
    await page.waitForSelector("[data-start-screen=home]");
  };
  try {
    await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-start-row]").first().click();
    await page.waitForSelector("[data-start-screen=home]", { timeout: 30000 });
    await shot("a01-home");
    for (const [i, y] of [400, 800, 1200, 1600, 2400].entries()) {
      await scrollSheet(y);
      await shot("a02-home-scroll" + i);
    }
    // dump some text facts
    const facts = await page.evaluate(() => {
      const q = (s) => [...document.querySelectorAll(s)].map((e) => ({ t: e.innerText.replace(/\s+/g, " ").trim(), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }));
      return { quick: q("[data-start-quick]"), steps: q("[data-start-step]"), games: q("[data-start-game]"), modes: q("[data-start-mode]"), links: q("[data-start-all],[data-start-rules]"), cardrows: q("[data-start-cardrow]") };
    });
    fs.writeFileSync(OUT + "facts.json", JSON.stringify(facts, null, 1));
    // disabled quick: tap it to see why
    const offQ = page.locator("[data-start-quick][aria-disabled=true]").first();
    if (await offQ.count()) {
      await offQ.scrollIntoViewIfNeeded();
      await offQ.click();
      await shot("a03-quick-off");
    }
    await scrollSheet(0);
    await page.locator("[data-start-mode=season]").click();
    await shot("a04-season");
    await scrollSheet(600);
    await shot("a04b-season-scroll");
    await scrollSheet(0);
    await page.locator("[data-start-mode=custom]").click();
    await page.waitForTimeout(300);
    const st = page.locator("[data-start-cview=stages]");
    if (await st.count()) await st.click();
    await shot("a05-custom-stages");
    await page.locator("[data-start-mode=tonight]").click();
    await page.waitForTimeout(300);
    await page.locator("[data-start-step=before]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-step=before]").click();
    await shot("a06-step-before");
    await scrollSheet(700);
    await shot("a06b-step-before-scroll");
    await back();
    await page.locator("[data-start-step=win]").click();
    await shot("a07-step-win");
    await back();
    await page.locator("[data-start-cardrow=bets]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-cardrow=bets]").click();
    await shot("a08-bets");
    await back();
    await page.locator("[data-start-rules]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-rules]").click();
    await shot("a09-rules");
    await back();
    await page.locator("[data-start-all]").click();
    await shot("a10-all");
    await scrollSheet(700);
    await shot("a10b-all-scroll");
    await back();
    await page.locator("[data-start-quick=comp]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-quick=comp]").click();
    await page.waitForTimeout(300);
    await scrollSheet(500);
    await shot("a11-after-comp");
    await page.locator("[data-start-shuffle]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-shuffle]").click();
    await page.waitForTimeout(300);
    await scrollSheet(300);
    await shot("a12-shuffle");
    await scrollSheet(900);
    await shot("a12b-shuffle-scroll");
    await page.locator("[data-start-describe]").scrollIntoViewIfNeeded();
    await page.locator("[data-start-describe]").click();
    await page.waitForTimeout(500);
    await shot("a13-describe");
    // keyboard focus sample
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await shot("a14-focus");
  } catch (e) {
    console.error(e);
    await page.screenshot({ path: OUT + "zz-error.png" });
  } finally {
    await close();
  }
})();
