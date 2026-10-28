// Screenshots every scenario in one group of the full-site mock's Mock scenarios menu (.impeccable/mocks/site/index.html),
// each from a fresh load, at phone size by default: the page a screen at a time, and an open sheet scrolled through its
// body. For design steps that add a scenario group (the desk parity steps: dks, dps, dis, dss, dsr, ...). Prints page errors.
// No dev server, login or DB.
//
//   node scripts/dev-test/shoot-mock-scenarios.js <outDir> --group=dss [--width=390] [--height=844] [--screens=3] [--n=4] [--only=ds2,ds5]
//
// --group is the scenario buttons' data attribute without "data-" (desk-setup.js's are data-dss). --screens caps how many
// screens of a long page are shot (sheets are shot until their end). Writes <outDir>/<key>[-s<k>|-sheet<k>].png.
// --mock=<folder> is the mock's site folder, for a lane's worktree, which has no mock (it's gitignored): pass the main
// folder's, e.g. --mock=C:\Users\conor\reality-fantasy-leagues\.impeccable\mocks\site. Default: this folder's.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

(async () => {
  const args = process.argv.slice(2);
  const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=")[1];
  const out = args.find((a) => !a.startsWith("--"));
  const group = opt("group", "");
  if (!out || !group) throw new Error("usage: shoot-mock-scenarios.js <outDir> --group=dss [--width=390] [--screens=3] [--only=a,b]");
  const width = +opt("width", 390), height = +opt("height", 844), screens = +opt("screens", 3), only = opt("only", "").split(",").filter(Boolean);
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width, height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(opt("mock", ".impeccable/mocks/site"), "index.html")).href + `?n=${opt("n", "4")}`;
  await page.goto(base, { waitUntil: "networkidle" });
  const keys = (await page.$$eval(`[data-${group}]`, (b, g) => b.map((x) => x.dataset[g]), group)).filter((k) => !only.length || only.includes(k));
  if (!keys.length) throw new Error(`no [data-${group}] scenarios in the mock menu`);
  const shot = async (f) => { await page.screenshot({ path: path.join(out, f) }); console.log("wrote", f); };
  for (const k of keys) {
    // a hash-only goto is a same-document navigation: reload so each scenario starts from the mock's own state
    await page.goto(base + "#/hub", { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.addStyleTag({ content: ".mockfab{display:none!important}" });
    await page.$eval(`[data-${group}="${k}"]`, (b) => b.click());
    await page.waitForTimeout(1700);
    await page.addStyleTag({ content: ".mockfab{display:none!important}" }).catch(() => {});
    if (await page.$(".sheet.on")) {
      // a sheet: shoot it, then scroll its body a screen at a time until the end
      for (let i = 0; i < 8; i++) {
        await shot(`${k}-sheet${i}.png`);
        const more = await page.$eval(".sheet.on .body", (b) => { const was = b.scrollTop; b.scrollTop += b.clientHeight * 0.8; return b.scrollTop > was; });
        if (!more) break;
        await page.waitForTimeout(200);
      }
      continue;
    }
    for (let i = 0; i < screens; i++) {
      await shot(i ? `${k}-s${i}.png` : `${k}.png`);
      const more = await page.evaluate(() => { const s = document.getElementById("scroller"); const was = s.scrollTop; s.scrollTop += s.clientHeight * 0.85; return s.scrollTop > was; });
      if (!more) break;
      await page.waitForTimeout(200);
    }
  }
  await close();
  console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
})().catch((e) => { console.error(e); process.exit(1); });
