// Clicks through the full-site mock's ways in (.impeccable/mocks/site), no dev server, login or DB needed:
//   A. landing → tap a show → search adds an unready show → where → account (Google) → people → join by code
//   B. landing → Join with a code → the invite, signed out → Join → account → where you are → catch-up
//   C. landing → Sign in → hub
// Asserts the route after each step, screenshots every step, and fails on any page error.
//
//   node scripts/dev-test/check-site-signup.js <outDir> [--width=390]
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: check-site-signup.js <outDir> [--width=390]");
  const width = +((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  let n = 0, fails = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`); await page.waitForTimeout(450); await page.screenshot({ path: f }); console.log("wrote", f); };
  const expectHash = async (want) => { const h = await page.evaluate(() => location.hash); if (h !== want) { fails++; console.log(`FAIL: at ${h}, wanted ${want}`); } };
  const expectText = async (sel, text) => { const t = await page.locator(sel).first().textContent().catch(() => ""); if (!t.toLowerCase().includes(text.toLowerCase())) { fails++; console.log(`FAIL: ${sel} lacks "${text}" (has "${t.slice(0, 80)}")`); } };
  const fresh = async (hash) => { await page.goto("about:blank"); await page.goto(base + "?n=0&motion=off" + hash, { waitUntil: "networkidle" }); await page.addStyleTag({ content: ".ctl,.mockfab{display:none!important}" }); await page.waitForTimeout(700); };

  // A. the main path in
  await fresh("");
  await expectHash("#/welcome");
  await shot("welcome");
  await page.evaluate(() => document.getElementById("lpGate").scrollIntoView());
  await page.click("#lpReveal");
  await page.waitForTimeout(5200);
  await shot("welcome-revealed");
  await page.evaluate(() => { document.getElementById("scroller").scrollTop = 0; });
  await page.evaluate(() => document.querySelector('[data-pick="trt"]').scrollIntoView({ block: "center" }));
  await page.click('[data-pick="trt"]');
  await expectHash("#/start/1");
  await expectText("#fnext", "1 picked");
  await shot("start1-from-tile");
  await page.click("#fsearch");
  await page.fill("#sq", "love");
  await shot("search-love");
  await page.click('[data-add="lib"]');
  await expectText(".frgrid", "Love Is Blind");
  await expectText("#fnext", "2 picked");
  await shot("start1-with-unready");
  await page.click("#fnext");
  await expectHash("#/start/2");
  await page.click('[data-w="lib"][data-d="1"]');
  await expectText("#wl-lib", "Episode 1 of 4");
  await shot("start2-where");
  await page.click("#fnext");
  await expectHash("#/start/3");
  await shot("start3-account");
  await page.click('[data-soc="Google"]');
  await shot("username-sheet");
  await page.click("#ungo");
  await expectHash("#/start/4");
  await shot("start4-people");
  await page.click("#fjoin");
  await page.click("#cpaste");
  await shot("code-sheet");
  await page.click("#cgo");
  await expectHash("#/join/K7Q2XZ");
  await expectText("#app", "riley saved");

  // B. an invite, signed out
  await fresh("#/welcome");
  await page.locator('[data-lp="code"]').first().click();
  await page.fill("#cin", "k7q2xz");
  await page.click("#cgo");
  await expectHash("#/join/K7Q2XZ");
  await shot("invite-signed-out");
  await page.click('[data-join="pool"]');
  await expectText("#sheet", "Make an account");
  await shot("invite-account");
  await page.click("#ago");
  await page.waitForTimeout(400);
  await expectText("#sheet", "Where are you in Survivor 51");
  await shot("invite-where");
  await page.click("#wsgo");
  await page.waitForTimeout(400);
  await expectText("#sheet", "Join Survival Pool");
  await shot("invite-catchup");

  // C. sign in
  await fresh("#/welcome");
  await page.click(".lp-signin");
  await expectHash("#/signin");
  await shot("signin");
  await page.click("#ago");
  await expectHash("#/hub");
  await shot("hub-after-signin");

  await close();
  if (errors.length) { fails++; console.log(`page errors: ${errors.join(" | ")}`); }
  console.log(fails ? `${fails} failure(s)` : "all good");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
