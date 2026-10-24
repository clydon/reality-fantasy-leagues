// Clicks through the full-site mock's watching features (.impeccable/mocks/site/watching.js), no dev server,
// login or DB needed:
//   A. hub nudge "you both watch" → Make it a game (paste, review) → start a Survival Pool → Your game on Tonight
//   B. a show you don't follow (Pluribus) → Add to my shows → where you are → it's on your list
//   C. Below Deck → Watch it together (start together) → open it → someone pauses for everyone → resume → send a GIF
//   D. the show menu → Watch privately
// Asserts each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-watching.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-watching.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  let n = 0, fails = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450); await page.screenshot({ path: f }); console.log("wrote", f); };
  const fail = (m) => { fails++; console.log("FAIL: " + m); };
  const expectHash = async (want) => { const h = await page.evaluate(() => location.hash); if (h !== want) fail(`at ${h}, wanted ${want}`); };
  const expectText = async (sel, text) => { const t = await page.locator(sel).first().textContent().catch(() => ""); if (!t.toLowerCase().includes(text.toLowerCase())) fail(`${sel} lacks "${text}" (has "${t.slice(0, 80)}")`); };
  const fresh = async (hash) => { await page.goto("about:blank"); await page.goto(base + "?n=4&motion=off" + hash, { waitUntil: "networkidle" }); await page.addStyleTag({ content: ".ctl,.mockfab{display:none!important}" }); await page.waitForTimeout(700); };

  // A. the both-watch nudge → Make it a game → a game
  await fresh("#/hub");
  await page.locator("#wNGo").scrollIntoViewIfNeeded();
  await shot("hub-nudge");
  await page.click("#wNGo");
  await page.waitForTimeout(700);
  await expectHash("#/show/ar/tonight");
  await expectText("#page", "Make The Amazing Race a game");
  await shot("make-step1");
  await page.click("#mkPaste");
  await expectText("#page", "Looks right");
  await page.click("#mkGo");
  await shot("make-review");
  await page.click("#mkOk");
  await page.waitForTimeout(500);
  await expectText("#sheet", "Start a game");
  await shot("start-a-game");
  await page.click("#wStart");
  await page.waitForTimeout(500);
  await expectText("#app", "Your game");
  await expectText("#app", "Make your first pick");
  await shot("ar-your-game");

  // B. follow a show only sam watches
  await fresh("#/show/plu/tonight");
  await expectText("#app", "sam watches this");
  await page.click('[data-wjob="follow"]');
  await page.click("#wl");
  await page.waitForTimeout(700);
  await expectHash("#/show/plu/tonight");
  await expectText("#app", "Spoiler-safe · you're on Ep 4");
  await shot("plu-followed");

  // C. watch it together, pause for everyone, a GIF
  await fresh("#/show/bd/tonight");
  await page.click('[data-wjob="invite"]');
  await page.click('[data-how="start"]');
  await shot("invite-sheet");
  await page.click("#wSend");
  await page.waitForTimeout(500);
  await expectText(".w-plan", "Starting together");
  await page.click('[data-wjob="together"]');
  await page.waitForTimeout(500);
  await expectText("#waStart", "Watching");
  await shot("together-start");
  await page.click("#waStart [data-start]");
  await page.waitForTimeout(10500);
  await expectText("#wPause", "paused for everyone");
  await shot("together-paused");
  await page.click("#wRes");
  if (await page.locator("#wPause").isVisible()) fail("the pause bar stayed up after Resume");
  await page.click("[data-gif]");
  await page.waitForTimeout(300);
  await shot("gif-sheet");
  await page.click('#gg [data-g="2"]');
  await page.waitForTimeout(400);
  if (!(await page.locator("#waS .w-gifcm").count())) fail("no GIF in the stream");
  await shot("gif-sent");

  // D. watch privately
  await fresh("#/show/bd/tonight");
  await page.click("#wMenu");
  await page.click('[data-wm="priv"]');
  await page.waitForTimeout(400);
  await expectText("#app", "Watching privately");
  await shot("bd-private");

  // F. the guide shows all of TV: the rest is faded under "Also on", hideable; your own shows can't be hidden
  await fresh("#/hub".replace("#", "&shows=surv#"));
  const tvCards = await page.locator("#reel .lst.g-tvc").count();
  if (!tvCards) fail("thin couch: the guide shows no other TV");
  const first = page.locator("#reel .lst.g-tvc").first(), firstId = await first.getAttribute("data-tv");
  await first.click();
  await expectText("#sheet", "Hide from guide");
  await shot("tv-listing-sheet");
  await page.click("#otHide");
  await page.waitForTimeout(400);
  if (await page.locator(`#reel .lst.g-tvc[data-tv="${firstId}"]`).count()) fail(`${firstId} still in the guide after hiding it`);
  await page.click("[data-hidden]");
  await page.click(`[data-unhide="${firstId}"]`);
  await page.waitForTimeout(400);
  if (!(await page.locator(`#reel .lst.g-tvc[data-tv="${firstId}"]`).count())) fail(`${firstId} didn't come back after Show again`);
  await page.click("#sheet [data-close]").catch(() => {});
  await shot("guide-all-tv");
  await fresh("#/hub");
  await page.locator('#reel .lst[data-show="surv"]').first().click();
  if (await page.locator("#epHide").count()) fail("your own show offers Hide from guide");
  await page.click("#sheet [data-close]"); await page.waitForTimeout(300);
  await page.locator('#reel .lst.g-not[data-show="li"]').first().click();
  if (!(await page.locator("#epHide").count())) fail("a couch show you don't follow has no Hide from guide");
  await page.click("#epHide");
  await page.waitForTimeout(400);
  if (await page.locator('#reel .lst[data-show="li"]').count()) fail("Love Island still in the guide after hiding it");

  // G. the hub (refined 2026-10-23): focus first, the rest of the couch one tap away under "More on the couch";
  // a brand-new couch (or a new member's first week) gets the short hub that grows as the couch plays
  const more = async (k) => { await page.click(`[data-more="${k}"]`); await page.waitForTimeout(400); };
  await fresh("#/hub");
  if (!(await page.locator(".r-status").count())) fail("hub: no one-line status at the top");
  if (!(await page.locator(".hn-now").count())) fail("full couch: no Who's on now strip");
  for (const [k, sel] of [["games", "#cbRow .cb-card.rank"], ["games", "#cbRow .cb-card.add"], ["numbers", "#supSec .sp-card.cast"], ["recaps", "#rcShelf"], ["verdicts", ".cv-list"]]) {
    await more(k); if (!(await page.locator(`#page ${sel}`).count())) fail(`More on the couch › ${k}: missing ${sel}`);
    if (k === "games" && await page.locator('#page [data-mini="wa"],#page [data-mini="party"]').count()) fail("Watch along is still in Commercial break");
    await page.click("#page [data-back]"); await page.waitForTimeout(350); }
  await fresh("&fresh=1#/hub");
  if (!(await page.locator(".r-grow").count())) fail("new couch: no note on what appears later");
  if (await page.locator('[data-more],#supSec,[data-past]').count()) fail("new couch: rankings, numbers or trophies show before there's anything in them");
  await fresh("#/hub");
  await more("numbers");
  const castCard = page.locator("#page #supSec .sp-card.cast").first(), stat = (await castCard.locator(".sp-t").textContent()).trim();
  await castCard.click();
  await page.waitForTimeout(400);
  const lead = (await page.locator("#page .st-cat").first().locator("h2").textContent()).trim();
  if (lead.toLowerCase() !== stat.toLowerCase()) fail(`By the numbers card "${stat}" opened the stats led by "${lead}"`);
  await shot("stats-sorted");
  await fresh("#/hub");
  await more("games");
  await page.click('#page #cbRow [data-cb="start"]');
  await expectText("#sheet", "Pick the show");
  await page.click("#sheet [data-close]"); await page.waitForTimeout(300);
  await fresh("#/show/surv/tonight".replace("#", "&fresh=1#"));
  await expectText("#app", "Stat of the week");
  await page.click(".st-all");
  await expectText("#page", "Never written down");
  await shot("stats-page");
  await fresh("#/show/surv/standings".replace("#", "&fresh=1#"));
  await expectText(".tabbar", "Stats");
  await fresh("#/show/bd/tonight");
  await page.click("[data-recap]");
  await expectText("#sheet", "Previously on");
  await fresh("#/show/bd/cast");
  await expectText("#app", "Who's who");

  // H. the stats explorer on Cast: Faces by faction, Rank by a full-named stat, the episode slider, the spoiler guard
  await fresh("#/show/surv/cast");
  if (!(await page.locator(".gd-chip").count())) fail("Cast: no spoiler guard chip");
  if ((await page.locator(".ex-gh").allTextContents()).filter((t) => /Toka|Savu|Dina/.test(t)).length < 2) fail("Faces: not grouped by tribe");
  if (await page.locator(".ex-face .dots, .ex-face .own").count()) fail("Faces: ownership dots are back");
  await page.click("[data-exv=rank]");
  await page.selectOption('[data-exsel="1"]', { label: "Voted with the majority" });
  await page.waitForTimeout(300);
  await expectText(".ex-pick", "Voted with the majority");
  const vals = await page.$$eval(".ex-r .val b", (t) => t.map((x) => +x.textContent));
  if (vals.some((v, i) => i && v > vals[i - 1])) fail("Rank: not sorted by the chosen stat");
  if ((await page.locator(".ex-t th").count())) fail("Rank: still an abbreviated table");
  await page.selectOption('[data-exsel="2"]', { label: "Idols found" });
  await page.waitForTimeout(300);
  await expectText(".ex-rank", "Idols found:");
  await page.$eval("#exFrom", (el) => { el.value = 3; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(400);
  await expectText("#exRL", "3 – 4");
  if ((await page.$eval("#exTo", (el) => +el.max)) > 4) fail("Slider goes past your episode");
  await page.selectOption('[data-exsel="f"]', "in");
  await page.waitForTimeout(300);
  if (await page.locator(".ex-r.out").count()) fail("Still in: shows people who are out");
  await page.click('[data-pat="0"]');
  await expectText('.ex-sel:has([data-exsel="f"]) b', "Savu");
  await page.click("[data-exv=heat]");
  if (!(await page.locator(".ex-heat td.hc").count())) fail("By episode: no heatmap");
  await page.click("[data-exv=rank]");
  await page.click("[data-excmp]");
  await page.locator("[data-exc]").nth(0).click();
  await page.locator("[data-exc]").nth(1).click();
  await expectText("#sheet", "Side by side");
  await page.click("#sheet [data-close]"); await page.waitForTimeout(300);
  await page.click("[data-exshare]");
  await expectText("#toast", "Shared with the couch");
  await shot("explorer-rank");
  // the guard: Traitors' secret factions never show for anyone still in
  await fresh("#/show/trt/cast");
  if ((await page.locator('[data-exsel="f"]').textContent()).match(/Faithful|Traitor/)) fail("Traitors: a secret faction is a filter");
  const stillIn = await page.locator(".ex-grp").filter({ hasText: "Still in" }).textContent();
  if (/Faithful|Traitor/.test(stillIn)) fail("Traitors: a secret faction shows for someone still in");
  await page.locator(".ex-grp").filter({ hasText: "Still in" }).locator("[data-exc]").first().click();
  await expectText("#sheet", "secret until they leave");
  await shot("explorer-traitors");
  await fresh("#/hub");
  await more("numbers");
  await page.locator("#page #supSec .sp-card.cast").first().click();
  await page.click("#exOpen");
  await page.waitForTimeout(600);
  if (!(await page.locator(".ex-rank").count()) || !(await page.evaluate(() => location.hash)).endsWith("/cast")) fail("See everyone ranked didn't land on Rank");

  // E. streaming shows: the guide has the drop day and planned nights; the rail is streaming's home
  await fresh("#/hub");
  if (!(await page.locator(".lst.b-drop").count())) fail("no drop day in the guide");
  if (!(await page.locator('.lst.b-plan[data-show="sev"]').count())) fail("riley and jordan's Severance night isn't in the guide");
  await expectText("#bRail", "Continue · Ep 4");
  await shot("streaming-rail");
  await page.click('#bRail [data-qadd="wire"]');
  await shot("quick-add-sheet");
  await page.click("#qGo");
  await page.waitForTimeout(400);
  if (await page.locator('#bRail [data-qadd="wire"]').count()) fail("The Wire still offers + after adding it");
  await page.locator('#wCW [data-qadd="plu"]').scrollIntoViewIfNeeded();
  await page.click('#wCW [data-qadd="plu"]');
  await page.click("#qGo");
  await page.waitForTimeout(400);
  if (await page.locator('#wCW [data-qadd="plu"]').count()) fail("Pluribus is still in The couch is watching after adding it");
  await expectText("#shelf", "Pluribus");
  await page.waitForTimeout(1200);
  // more than a day out the hero reads calmly ("Wed 8:05 PM · in 5 days"); inside the last day it counts down
  if (await page.locator("#cd").count()) { if ((await page.locator("#cd").innerText()).replace(/\s+/g, " ").startsWith("00 DAYS : 00 HRS : 00 MIN")) fail("the hub countdown reset to zero after a re-render"); }
  else if (!/in \d+ days|tomorrow|today/i.test(await page.locator(".r-when").innerText().catch(() => ""))) fail("the hub's Up next has neither a countdown nor a calm time");
  await shot("shelf-added");
  await page.evaluate(() => { afterDrop(); route(); });
  await page.waitForTimeout(500);
  await expectText("#bRail", "New · all 8 out");
  await shot("after-the-drop");
  await fresh("#/show/sev/tonight");
  await expectText("#app", "you're on Ep 3");
  await page.click("[data-bjoin]");
  await expectText("#toast", "Catch up to 6");
  await page.click('[data-wjob="where"]');
  await page.click("#wl");
  await page.waitForTimeout(600);
  await expectText("#app", "Finished");
  await fresh("#/show/hp/tonight");
  await expectText("#app", "Drops");
  await page.click('[data-wjob="invite"]');
  await page.click("#bSend");
  await page.waitForTimeout(500);
  await expectText(".w-plan", "Episode 1");
  await shot("hp-premiere-planned");
  await page.click(".back");
  await page.waitForTimeout(600);
  if ((await page.locator('.lst.b-plan[data-show="hp"]').count()) < 1) fail("the planned premiere isn't in the guide");

  await close();
  if (errors.length) fail(`page errors: ${errors.join(" | ")}`);
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
