// Screenshots routes of the full-site mock (.impeccable/mocks/site/index.html) at phone size, no dev
// server or login needed, and prints any page errors. Use it at the start of a session to see where the
// mock stands, or after an edit to check every screen you touched.
//
//   node scripts/dev-test/shoot-site.js <outDir> [route ...] [--n=4|12|1|0] [--sheet] [--scroll]
//
// Routes are hash routes ("#/hub", "#/show/surv/tonight"); with none, a standard tour of every area is
// taken. --n sets the mock crowd (4, 12, 1 = solo, 0 = new player). --sheet also writes one contact
// sheet (sheet.jpg) of all the shots side by side. --scroll also shoots each route a screen at a time down
// its whole length (<nn>-<route>-s<k>.png), for long pages like #/welcome. Writes <outDir>/<nn>-<route>.png.
// No DB access.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

const TOUR = ["#/hub", "#/show/surv/tonight", "#/show/surv/episodes", "#/show/surv/standings", "#/show/surv/cast", "#/show/surv/chat", "#/show/ar/tonight", "#/show/plu/tonight",
  "#/show/surv/draft", "#/show/surv/backstage", "#/show/surv/backstage/results", "#/show/surv/backstage/settings", "#/account", "#/welcome", "#/start/1", "#/start/3", "#/signin", "#/join/K7Q2XZ"];

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("#") && !a.startsWith("--"));
  if (!out) throw new Error("usage: shoot-site.js <outDir> [route ...] [--n=4] [--sheet]");
  const n = (args.find((a) => a.startsWith("--n=")) || "--n=4").slice(4);
  const routes = args.filter((a) => a.startsWith("#"));
  const list = routes.length ? routes : TOUR;
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href + `?n=${n}`;
  const files = [];
  for (const [i, r] of list.entries()) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: ".mockfab{display:none!important}" });
    await page.waitForTimeout(900);
    const f = path.join(out, `${String(i + 1).padStart(2, "0")}-${r.replace(/[#/]+/g, "_").replace(/^_/, "")}.png`);
    await page.screenshot({ path: f });
    files.push(f);
    console.log("wrote", f);
    if (args.includes("--scroll")) {
      const h = await page.evaluate(() => document.getElementById("scroller").scrollHeight);
      for (let k = 1, y = 760; y < h - 200; k++, y += 760) {
        await page.evaluate((top) => { document.getElementById("scroller").scrollTop = top; }, y);
        await page.waitForTimeout(1000);
        const fk = f.replace(/\.png$/, `-s${k}.png`);
        await page.screenshot({ path: fk });
        files.push(fk);
        console.log("wrote", fk);
      }
    }
  }
  await close();
  if (args.includes("--sheet")) {
    const sharp = require("sharp");
    const W = 390, H = 844;
    const imgs = await Promise.all(files.map((f) => sharp(f).resize(W, H).toBuffer()));
    await sharp({ create: { width: (W + 8) * imgs.length, height: H, channels: 3, background: "#000" } })
      .composite(imgs.map((b, i) => ({ input: b, left: i * (W + 8), top: 0 }))).jpeg({ quality: 72 }).toFile(path.join(out, "sheet.jpg"));
    console.log("wrote", path.join(out, "sheet.jpg"));
  }
  console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
})().catch((e) => { console.error(e); process.exit(1); });
