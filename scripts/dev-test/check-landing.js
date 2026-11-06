// Checks the signed-out front door: "/" serves the landing page (server-rendered, with its FAQ
// JSON-LD), /sign-in shows the sign-in screen and lands on the app after signing in, and a signed-in
// visit to "/" still opens the app, not the landing page. Screenshots go to <outDir>.
//
//   node scripts/dev-test/check-landing.js <outDir> [width=390]
//
// Needs `npm run dev` and the zt_ admin (db/seed-dev-admin.js with SEED_ADMIN_USERNAME=zt_tester
// SEED_ADMIN_PASSWORD=zt-pass-12345). Signs in as zt_tester only; touches no data.
const path = require("path");
const { open } = require("./browser");
const BASE = process.env.BASE || "http://localhost:3000";
const ZT_USER = process.env.ZT_USER || "zt_tester";
const ZT_PASS = process.env.ZT_PASS || "zt-pass-12345";

(async () => {
  const [out, w = "390"] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-landing.js <outDir> [width]");
  const width = parseInt(w, 10);
  const fails = [];
  const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };

  // 1. signed out: the landing page
  let { page, close } = await open({ width, height: 844 });
  const errors = [];
  const T0 = Date.now();
  page.on("pageerror", (e) => errors.push(`${new URL(page.url()).pathname}: ${e.message.slice(0, 3000)} @${Date.now() - T0}ms`));
  page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(`${new URL(page.url()).pathname}: ${m.text().slice(0, 600)}`); });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check(await page.locator(".gys-landing h1").isVisible(), "signed-out / shows the landing page");
  check((await page.locator('script[type="application/ld+json"]').count()) >= 2, "landing carries JSON-LD");
  check(await page.locator(".gys-landing .preview").isVisible(), "preview flag is visible");
  check((await page.evaluate(() => document.documentElement.scrollWidth)) <= width, "no sideways scroll");
  await page.screenshot({ path: path.join(out, `landing-live-${width}.png`) });

  // 2. Sign in → /sign-in → the app at "/"
  await page.locator(".gys-landing header .signin").click();
  await page.waitForURL("**/sign-in");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `signin-live-${width}.png`) });
  const pw = page.locator('input[type="password"]');
  check(await pw.isVisible(), "/sign-in shows the sign-in form");
  await page.locator('input:not([type="password"])').first().fill(ZT_USER);
  await pw.fill(ZT_PASS);
  await pw.press("Enter");
  // The app: the new design's /home since 0155 (everyone on it), classic's / for an account that chose classic.
  await page.waitForURL((u) => ["/", "/home"].includes(new URL(u).pathname), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  check(["/", "/home"].includes(new URL(page.url()).pathname), "after signing in you're in the app (/home on the new design)", page.url());
  check(!(await page.locator(".gys-landing").count()), "signed in, / is the app, not the landing page");
  await page.screenshot({ path: path.join(out, `after-signin-${width}.png`) });
  check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await close();

  // 3. a fresh visit with a session goes straight to the app
  ({ page, close } = await open({ user: ZT_USER, pass: ZT_PASS, width, height: 844 }));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  check(!(await page.locator(".gys-landing").count()), "returning signed-in visit skips the landing page");
  await close();

  console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
