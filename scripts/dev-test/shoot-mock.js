// Screenshots a standalone HTML mock (e.g. .impeccable/mocks/overdrive/*.html) in the dev-test headless
// Chromium, no dev server or login needed. Waits for intro animation, optionally runs a few steps first
// (scroll to the bottom so scroll-reveals fire, set a range input), and prints any page errors.
//
//   node scripts/dev-test/shoot-mock.js <file.html> <outDir> [width=390] [--wait=3500] [--full]
//        [--range=<css>:<value>] [--scroll] [--reduce] [--query=bar=b&s=air] [--at=<css>[,<css>...]]
// --at scrolls each selector to the top and writes one viewport shot per selector (-at1, -at2...).
//
// Writes <outDir>/<name>-<width>[-suffix].png. --full grows to the page; otherwise one viewport.
// No DB access, so nothing to clean up.
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const [file, out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: shoot-mock.js <file.html> <outDir> [width] [--wait=ms] [--full] [--range=sel:v] [--scroll] [--reduce]");
  const width = parseInt(w, 10);
  const flag = (n) => (flags.find((f) => f.startsWith(`--${n}=`)) || "").slice(n.length + 3);
  const wait = Number(flag("wait")) || 3500;
  const reduce = flags.includes("--reduce");
  const { page, close } = await open({ width, height: 844, motion: reduce ? "reduce" : "on" });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  const query = flag("query");
  await page.goto(pathToFileURL(path.resolve(file)).href + (query ? "?" + query : ""), { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  if (flags.includes("--scroll")) {
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await page.waitForTimeout(1200);
  }
  const range = flag("range");
  if (range) {
    const i = range.lastIndexOf(":");
    await page.evaluate(([sel, v]) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, [range.slice(0, i), range.slice(i + 1)]);
    await page.waitForTimeout(800);
  }
  const name = path.basename(file, ".html");
  const at = flag("at");
  if (at) {
    let i = 0;
    for (const sel of at.split(",")) {
      i++;
      await page.evaluate((s) => { const el = document.querySelector(s); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sel);
      await page.waitForTimeout(1600);
      const d = path.join(out, `${name}-${width}-at${i}.png`);
      await page.screenshot({ path: d });
      console.log("wrote", d);
    }
    await close();
    return;
  }
  const suffix = [query && query.replace(/[^a-z0-9]+/gi, "_"), range && "r" + range.split(":").pop(), reduce && "reduce"].filter(Boolean).join("-");
  const dest = path.join(out, `${name}-${width}${suffix ? "-" + suffix : ""}.png`);
  await page.screenshot({ path: dest, fullPage: flags.includes("--full") });
  console.log("wrote", dest);
  await close();
})().catch((e) => { console.error(e); process.exit(1); });
