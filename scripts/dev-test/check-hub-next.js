// Dev-only check of the hub's next thing and its On TV door (the design round's step 7: docs/design-round/step7-hub-spec.md), on
// new-fixture.js's zt_nd couch at a phone's width (390 by default):
//   - as alex and casey (a move due on Survivor 51): the plate's move opens in one tap, Your moves on the show for a pick (the show
//     with `?moves=`, then the address drops it) or its own page for a waiver claim or a draft; no status line beside the plate;
//     each face carries its mark;
//   - with --reveal, as sam (two behind, results waiting): the plate's Reveal goes to the reveal (`?page=reveal`). Opening it
//     reveals, as a tap on Reveal does: sam's mark moves, so bring the couch up again after (census-app.js --up);
//   - On TV: the bug opens the guide as its own page (`?page=guide`, the week's seven cells, today's rundown), Back closes it to the
//     hub; a card in the crawl opens its show (the user, 2026-11-19).
// Needs: the app on :3000 (npm run dev; BASE= for another) and the zt_nd couch up (census-app.js --up, or new-fixture.js up). Reads
// only, but for --reveal. Never beside another check on the zt_nd fixture.
// Run:   node scripts/dev-test/check-hub-next.js [--width=390] [--reveal] [--out=<dir for a frame of each step>]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open, BASE } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const W = Number(opt("width", 390));
const OUT = opt("out", null);
const PASS = "zt-pass-12345";
let failures = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${String(detail).slice(0, 200)})` : ""}`);
  if (!ok) failures++;
};
const shot = async (page, name) => OUT && page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 82 });

async function as(who, fn) {
  const b = await open({ user: `zt_nd_${who}`, pass: PASS, width: W, height: 844, motion: "reduce" });
  try {
    await b.page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
    await b.page.locator("[data-upnext]").first().waitFor({ timeout: 45000 });
    await b.page.waitForTimeout(1200);
    await fn(b.page);
  } catch (e) {
    check(false, `${who}: ran to the end`, e.message.split("\n")[0]);
  } finally {
    await b.close();
  }
}

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  for (const who of ["alex", "casey"]) await as(who, async (p) => {
    const alex = who;
    check((await p.locator("[data-hub] [data-status]:not([data-upnext-plate])").count()) === 0, `${who}: no status line beside the plate`);
    check((await p.locator("[data-band-face]").count()) >= 2, `${who}: the faces carry their marks`);
    const plate = p.locator('[data-upnext-plate="move"]');
    check((await plate.count()) === 1, `${alex}: the plate holds the due move`);
    const href = (await plate.getAttribute("href")) ?? "";
    // A pick or a lineup opens Your moves on the show; a waiver claim, a draft turn or a blind draft opens its own page.
    const own = href.match(/\/show\/[^/]+\/(waivers|draft|blind)\b/)?.[1] ?? null;
    check(own || /[?&]moves=/.test(href), `${alex}: the move's address is its sheet or its page`, href);
    await plate.click();
    if (own) {
      await p.waitForURL(new RegExp(`/${own}\\b`), { timeout: 30000 });
      check(true, `${alex}: one tap on the plate opens the ${own} page`);
    } else {
      await p.locator('[role="dialog"]').filter({ hasText: "Your moves" }).first().waitFor({ timeout: 30000 });
      check(true, `${alex}: one tap on the plate opens Your moves`);
      await p.waitForTimeout(400);
      check(!/[?&]moves=/.test(p.url()), `${alex}: the address drops ?moves= once it's open`, p.url());
    }
    await p.waitForTimeout(1200);
    await shot(p, `1-plate-opens-move-${who}`);
  });
  if (args.includes("--reveal")) await as("sam", async (p) => {
    const plate = p.locator('[data-upnext-plate="reveal"]');
    check((await plate.count()) === 1, "sam: the plate holds the reveal");
    await plate.click();
    await p.waitForURL(/page=reveal/, { timeout: 30000 });
    check(/\/tonight\?page=reveal&ep=\d+/.test(p.url()), "sam: Reveal goes to the reveal", p.url());
    await p.waitForTimeout(1500);
    await shot(p, "2-plate-opens-reveal");
  });
  await as("alex", async (p) => {
    await p.locator("[data-on-tv-open]").click();
    await p.locator("[data-guide-page]").waitFor({ timeout: 15000 });
    check(/[?&]page=guide/.test(p.url()), "On TV opens the guide as its own page", p.url());
    check((await p.locator("[data-guide-cell]").count()) === 7, "the guide: seven day cells");
    check((await p.locator('[data-guide-page] [data-guide-day="0"]').count()) === 1, "the guide opens on today");
    await shot(p, "3-guide");
    await p.locator('[role="dialog"]:has([data-guide-page]) button:has-text("Home")').click();
    await p.waitForTimeout(900);
    check(!/page=guide/.test(p.url()) && (await p.locator("[data-on-tv]").isVisible()), "Back closes the guide to the hub", p.url());
    // A crawl card opens its show, not the guide (the user, 2026-11-19).
    const card = p.locator('[data-on-tv] [data-guide-card]:not([data-guide-card^="tour-"]):not([data-guide-card^="sport:"])').first();
    if (await card.count()) {
      const seasonId = (await card.getAttribute("data-guide-card")).split(":")[0];
      await card.click();
      await p.waitForURL((u) => u.pathname.includes(seasonId), { timeout: 15000 }).catch(() => {});
      check(p.url().includes(seasonId) && !/page=guide/.test(p.url()), "a crawl card opens its show", p.url());
      await shot(p, "4-crawl-card-show");
    } else check(false, "the crawl has a show card");
  });
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})();
