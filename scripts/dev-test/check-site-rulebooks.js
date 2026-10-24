// Checks the full-site mock's kinds of show and rulebooks (.impeccable/mocks/site/rulebook.js), no dev server, login
// or DB needed:
//   K. Make it a game, per kind: Ask ChatGPT for me → the review shows the kind as one line (a competition, a series ·
//      reality/scripted, talk, a sport); Change kind works; Start a game offers only the games that fit
//   F. Formula 1 played: draft five drivers, three start, bench one; the show says "Race", never "Episode"
//   H. How the season works: the rundown, a cell per episode, an update past your episode stays hidden
//   B. Backstage › Scoring rules: Following → Make it ours → add a moment
//   N. The show changed: Episode 5's "Something the rulebook doesn't have" → It's new → added
//   A. Admin: Find lists rulebooks; a rulebook's Override asks fix or show-changed; History records it
// Asserts each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-rulebooks.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-rulebooks.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  let n = 0, fails = 0;
  // clicking scrolls the phone frame itself (a user can't), which drags a closed sheet into view: undo that first
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450);
    await page.evaluate(() => [document.scrollingElement, document.getElementById("device")].forEach((el) => { if (el) el.scrollTop = 0; }));
    await page.screenshot({ path: f }); console.log("wrote", f); };
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  const textOf = (sel) => page.locator(sel).first().textContent().catch(() => "");
  const expectText = async (sel, text) => { const t = await textOf(sel); if (!t.toLowerCase().includes(text.toLowerCase())) fail(`${sel} lacks "${text}" (has "${t.slice(0, 90)}")`); };
  const fresh = async (q, hash) => { await page.goto("about:blank"); await page.goto(base + "?motion=off&frame=1" + q + hash, { waitUntil: "networkidle" }); await page.waitForTimeout(800); };
  const tap = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(350); };

  // K. Make it a game, per kind
  // Formula 1 goes last: its Start a game sheet stays open for step F
  const kinds = [["bd", "A series · reality", 1], ["plu", "A series · scripted", 1], ["snl", "Talk, variety or awards", 2], ["ar", "A competition", 3], ["f1", "A sport or live event", 2]];
  for (const [sid, kind, games] of kinds) {
    await fresh("&n=4", `#/show/${sid}/standings`);
    await expectText(".rb-plate", "Make");
    await tap('.rb-plate [data-wjob="make"]');
    await tap("#mkAsk");
    await page.waitForTimeout(3600);
    await expectText(".rb-kind b", kind);
    if (sid === "bd" || sid === "f1" || sid === "snl") await shot(`review-${sid}`);
    if (sid === "plu") {
      await tap("[data-kind]");
      await tap('#sheet [data-fl="Reality"]');
      await tap("#kGo");
      await expectText(".rb-kind b", "reality");
      await tap("[data-kind]");
      await tap('#sheet [data-fl="Scripted"]');
      await tap("#kGo");
    }
    await page.locator("#mkOk").scrollIntoViewIfNeeded();
    await tap("#mkOk");
    await page.waitForTimeout(400);
    const offered = await page.locator("#sheet.on [data-g]").count();
    if (offered !== games) fail(`${sid}: Start a game offers ${offered} games, wanted ${games}`);
    if (sid !== "ar" && !(await page.locator("#sheet .rb-nofit").count())) fail(`${sid}: no "doesn't fit" line`);
    if (sid === "f1") await shot("start-f1");
  }

  // F. Formula 1 played
  await tap("#wStart");
  await expectText(".rb-plate", "Draft your five");
  await tap("[data-f1draft]");
  for (const d of ["Lando Norris", "Max Verstappen", "Charles Leclerc", "Kimi Antonelli", "Oliver Bearman"]) await tap(`#page [data-pk="${d}"]`);
  await shot("f1-draft");
  await tap("#f1Go");
  if ((await page.locator(".f1-row").count()) !== 5) fail("F1: wanted 5 drivers on the Games tab");
  if ((await page.locator(".f1-sw.on").count()) !== 3) fail("F1: wanted 3 starting");
  await tap('[data-f1="Charles Leclerc"]');
  if ((await page.locator(".f1-sw.on").count()) !== 2) fail("F1: benching one should leave 2 starting");
  await shot("f1-games");
  await page.goto(base + "?motion=off&frame=1&n=4&rb=f1play#/show/f1/tonight", { waitUntil: "networkidle" }); await page.waitForTimeout(700);
  const f1txt = await page.locator("#app").innerText();
  if (/\bEpisode\b/.test(f1txt)) fail(`F1 Tonight still says Episode: "${f1txt.match(/.{0,30}\bEpisode\b.{0,30}/)[0]}"`);
  await shot("f1-tonight");

  // H. How the season works
  await fresh("&n=4", "#/show/surv/standings");
  await page.evaluate(() => { RBS.new5 = "confirmed"; SHOWSTATE.revealed = 4; });
  await tap("[data-rbhow]");
  if ((await page.locator("#page .rb-seg").count()) !== 4) fail("How it works: wanted 4 parts in Each episode");
  if ((await page.locator("#page .rb-strip i").count()) !== 14) fail("How it works: wanted 14 episode cells");
  if ((await page.locator("#page .rb-u.hid").count()) !== 1) fail("How it works: the Episode 5 update should stay hidden at Episode 4");
  await shot("how-top");
  await page.evaluate(() => { const p = document.getElementById("page"); p.scrollTop = p.querySelector("#rbj-season").offsetTop - 60; });
  await shot("how-season");
  await page.evaluate(() => { const p = document.getElementById("page"); p.scrollTop = p.querySelector("#rbj-pts").offsetTop - 60; });
  await shot("how-points");

  // B. Backstage › Scoring rules
  await fresh("&n=4&rb=new5", "#/show/surv/backstage/rules");
  await expectText(".rb-follow", "Following");
  await shot("bs-following");
  await tap('[data-rbb="ours"]');
  await tap("#rbOurs");
  await expectText(".rb-follow", "own rulebook");
  await tap('[data-rbb="add"]');
  await page.fill("#amT", "Cries at Tribal Council");
  await tap("#amGo");
  await expectText("#app", "Cries at Tribal Council");
  await shot("bs-ours");

  // N. The show changed
  await fresh("&n=4&rb=new5", "#/show/surv/episodes");
  await page.evaluate(() => episodePage(5));
  await page.waitForTimeout(500);
  await expectText("#page .rb-newsec", "doesn't have");
  await page.evaluate(() => document.querySelector("#page .rb-newsec").scrollIntoView({ block: "center" }));
  await shot("new-reported");
  await tap('#page [data-rbn="yes"]');
  await expectText("#page .rb-newsec", "is in the rulebook");

  // K2. a talk show's Games tab once made: Weekly Bingo and Weekly Calls, no draft
  await fresh("&n=4&rb=made", "#/show/snl/standings");
  await expectText(".rb-plate", "Weekly Bingo");
  await shot("snl-games");

  // A. Admin
  await fresh("&n=4", "#/admin/find");
  await page.fill("#admQ", "rulebook");
  await page.waitForTimeout(300);
  if ((await page.locator("#admR .idx").count()) !== 3) fail("Admin Find: wanted 3 rulebooks");
  await tap('#admR a[href="#/admin/rb/s51"]');
  if ((await page.locator("[data-rbov]").count()) < 6) fail("Admin rulebook: wanted every part with Override");
  await shot("admin-rulebook");
  await tap('[data-rbov="2"]');
  await tap('#sheet [data-ovk="show"]');
  if (await page.locator("#ovFrom").isHidden()) fail("Override: The show changed should ask from which episode");
  await shot("admin-override");
  await tap("#ovGo");
  await expectText(".adm-body", "You overrode");

  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
