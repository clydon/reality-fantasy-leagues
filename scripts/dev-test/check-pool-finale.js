// BACKLOG 115: a Survival Pool says its finale rule (only the winner survives the finale: state-logic.js nightOf) where it's played.
// How it plays on the pool's game page says it whatever the episode; the pick sheet says it on the finale's pick only, in the same
// words. Two bring-ups of the zt_nd couch (new-fixture.js): its 13-episode season (Episode 6 is an ordinary pick) and a 6-episode
// one (Episode 6 is the finale). Screenshots at --width (390 by default) for the story.
// Needs: the app on :3000 (npm run dev). zt_nd rows only, never a real account; takes the couch down after unless --keep.
// Run: node scripts/dev-test/check-pool-finale.js [--out=.ui-atlas/stories/pool-finale] [--width=390] [--keep]
// Never beside another check on the zt_nd couch.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/pool-finale"));
const WIDTH = Number(opt("width", 390));
const RULE = "In the finale only the winner survives, so pick who you think wins.";
let bad = 0;
const check = (ok, what, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` ${extra}`}`);
  if (!ok) bad++;
};

/** Riley on the couch as `up` made it: the pool's How it plays, then the pick sheet from Tonight's strip. */
async function look(db, episodes, tag) {
  const made = await fixture.up(db, { episodes, through: 5 });
  const a = await open({ user: "zt_nd_riley", pass: fixture.PASSWORD, width: WIDTH, height: 844, motion: "reduce" });
  const p = a.page;
  try {
    await p.goto(`${BASE}/show/${made.seasonId}/game/${made.leagues.pool}`);
    await p.locator("[data-game-rules]").first().waitFor({ timeout: 45000 });
    await p.waitForTimeout(1000);
    const rules = await p.locator("[data-game-rules] li").allInnerTexts();
    check(rules.includes(RULE), `${tag}: How it plays says the finale rule`, JSON.stringify(rules));
    await p.locator("[data-game-rules]").first().scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `${tag}-how-it-plays.jpg`), type: "jpeg", quality: 82 });

    await p.goto(`${BASE}/home`);
    await p.waitForTimeout(2000);
    const u = await p.evaluate(() => [...document.querySelectorAll("a")].map((x) => x.href).find((h) => /\/show\/[^/]+\/tonight/.test(h)));
    await p.goto(u);
    await p.locator("[data-strip] button").first().waitFor({ timeout: 45000 });
    await p.locator("[data-strip] button").first().click();
    const here = p.locator('[data-moves-games] [data-pane="1"]');
    await here.locator("[data-pick]").first().waitFor({ timeout: 10000 });
    await p.waitForTimeout(800);
    const line = here.locator("[data-pick-finale]");
    const finale = episodes === 6;
    check((await line.count()) === (finale ? 1 : 0), finale ? `${tag}: the finale's pick says only the winner survives` : `${tag}: an ordinary pick says nothing of the finale`, await here.innerText().catch(() => ""));
    if (finale) check(/^Who wins\? In the finale only the winner survives\./.test(await line.innerText()), `${tag}: in How it plays' words`, await line.innerText());
    await p.screenshot({ path: path.join(OUT, `${tag}-pick.jpg`), type: "jpeg", quality: 82 });
  } finally {
    await a.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    await look(db, 13, "ep6-of-13");
    await look(db, 6, "ep6-finale");
    if (!args.includes("--keep")) await fixture.down(db);
  } finally {
    await db.end();
  }
  console.log(bad ? `${bad} FAILED` : "ALL PASS");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
