// A design-review tour of the full-site mock (.impeccable/mocks/site/): every area AND the states behind taps
// (sheets, the moves dock, the reveal, Watch along, waivers, admin), each long screen shot a screen at a time,
// plus one contact sheet per area. For critiques and before/after comparisons; no server, login or DB.
//
//   node scripts/dev-test/tour-site-states.js <outDir> [--only=hub,show,...] [--screens=3]
//
// Areas: in (ways in), hub, show (Survivor in a game), night (episode night), watch (watch-only and streaming),
// moves (dock, waivers), run (Backstage, draft), community (disputes, admin), you (account).
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { open } = require("./browser");

const T = {
  in: [["welcome", "?n=0", "#/welcome", 4], ["start-1", "?n=0", "#/start/1"], ["start-2", "?n=0", "#/start/2"], ["start-3", "?n=0", "#/start/3"], ["start-4", "?n=0", "#/start/4"], ["signin", "?n=0", "#/signin"], ["join", "?n=4", "#/join/K7Q2XZ", 2]],
  hub: [["hub-4", "?n=4", "#/hub", 6], ["hub-12", "?n=12", "#/hub", 2], ["hub-solo", "?n=1", "#/hub", 3], ["hub-new", "?n=0", "#/hub", 2], ["hub-fresh", "?n=4&fresh=1", "#/hub", 3], ["hub-thin", "?n=4&shows=surv", "#/hub", 2],
    ["add-show", "?n=4", "#/hub", 1, (p) => p.click("#addShow")], ["profile", "?n=4", "#/hub", 1, (p) => p.click("#meBtn")]],
  show: [["tonight", "?n=4", "#/show/surv/tonight", 3], ["episodes", "?n=4", "#/show/surv/episodes", 2], ["standings", "?n=4", "#/show/surv/standings", 2], ["cast-faces", "?n=4", "#/show/surv/cast", 2],
    ["cast-rank", "?n=4", "#/show/surv/cast", 2, (p) => p.click("[data-exv=rank]")], ["chat", "?n=4", "#/show/surv/chat", 1], ["show-menu", "?n=4", "#/show/surv/tonight", 1, (p) => p.click("#showMenu")],
    ["episode-page", "?n=4", "#/show/surv/episodes", 1, (p) => p.click('[data-ep="4"]')], ["trt-tonight", "?n=4", "#/show/trt/tonight", 2], ["solo-show", "?n=1", "#/show/surv/tonight", 2]],
  night: [["during", "?n=4", "#/show/surv/tonight", 2, (p) => p.evaluate(() => { SHOWSTATE.phase = "during"; route(); })],
    ["after-waiting", "?n=4", "#/show/surv/tonight", 2, (p) => p.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "waiting"; route(); })],
    ["after-early", "?n=4", "#/show/surv/tonight", 2, (p) => p.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "early"; route(); })],
    ["reveal-1", "?n=4", "#/show/surv/tonight", 1, (p) => p.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "early"; revealPlay(SHOWS[0]); })],
    ["reveal-3", "?n=4", "#/show/surv/tonight", 1, async (p) => { await p.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "early"; revealPlay(SHOWS[0]); }); for (let i = 0; i < 2; i++) { await p.waitForTimeout(300); await p.click("#rstage"); } }],
    ["after-revealed", "?n=4", "#/show/surv/tonight", 2, (p) => p.evaluate(() => { SHOWSTATE.phase = "after"; SHOWSTATE.res = "final"; SHOWSTATE.revealed = 5; route(); })]],
  watch: [["ar", "?n=4", "#/show/ar/tonight", 2], ["plu", "?n=4", "#/show/plu/tonight", 2], ["bd", "?n=4", "#/show/bd/tonight", 2], ["watch-along", "?n=4", "#/show/bd/tonight", 1, (p) => p.evaluate(() => openWatch("bd"))],
    ["sev", "?n=4", "#/show/sev/tonight", 2], ["hp", "?n=4", "#/show/hp/tonight", 1], ["chl-explore", "?n=4", "#/show/chl/tonight", 2]],
  moves: [["dock-sheet", "?n=4", "#/show/surv/tonight", 1, (p) => p.click("#dock")], ["waivers", "?n=4", "#/show/surv/waivers", 2], ["waivers-pick", "?n=4&wvsheet=pick", "#/show/surv/waivers", 1],
    ["bingo", "?n=4", "#/show/surv/tonight", 1, (p) => p.evaluate(() => bingoSheet())]],
  run: [["backstage", "?n=4", "#/show/surv/backstage", 2], ["bs-results", "?n=4", "#/show/surv/backstage/results", 2], ["bs-waivers", "?n=4", "#/show/surv/backstage/waivers", 2], ["bs-rules", "?n=4", "#/show/surv/backstage/rules", 2],
    ["bs-members", "?n=4", "#/show/surv/backstage/members", 1], ["bs-settings", "?n=4", "#/show/surv/backstage/settings", 2], ["draft", "?n=4", "#/show/surv/draft", 2], ["blind", "?n=4", "#/show/surv/blind", 1]],
  community: [["dispute", "?n=4&wd=flag", "#/show/surv/episodes", 1], ["correction", "?n=4&wd=corr", "#/show/surv/episodes", 1], ["admin-inbox", "?n=4", "#/admin/inbox", 2], ["admin-fact", "?n=4", "#/admin/fact/d1", 2]],
  you: [["account", "?n=4", "#/account", 3]],
};

(async () => {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith("--"));
  if (!out) throw new Error("usage: tour-site-states.js <outDir> [--only=hub,show] [--screens=3]");
  const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
  const cap = +((args.find((a) => a.startsWith("--screens=")) || "--screens=6").slice(10));
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(path.resolve(".impeccable/mocks/site/index.html")).href;
  const sharp = require("sharp");
  for (const [area, list] of Object.entries(T)) {
    if (only.length && !only.includes(area)) continue;
    const shots = [];
    for (const [name, q, hash, screens = 1, act] of list) {
      await page.goto("about:blank");
      await page.goto(base + q + "&motion=off&frame=1" + hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      if (act) { try { await act(page); } catch (e) { errors.push(`${area}/${name}: ${e.message.split("\n")[0]}`); } await page.waitForTimeout(700); }
      const n = Math.min(screens, cap);
      for (let k = 0; k < n; k++) {
        if (k) { const moved = await page.evaluate((k) => { const s = document.getElementById("scroller"); const before = s.scrollTop; s.scrollTop = k * (s.clientHeight - 120); return s.scrollTop !== before; }, k); if (!moved) break; await page.waitForTimeout(350); }
        const f = path.join(out, `${area}-${name}${n > 1 ? `-s${k + 1}` : ""}.png`);
        await page.screenshot({ path: f });
        shots.push(f);
      }
    }
    for (let i = 0; i < shots.length; i += 8) {
      const part = shots.slice(i, i + 8);
      const imgs = await Promise.all(part.map((f) => sharp(f).resize(390, 844).toBuffer()));
      const sheet = path.join(out, `_sheet-${area}${shots.length > 8 ? `-${i / 8 + 1}` : ""}.jpg`);
      await sharp({ create: { width: 398 * imgs.length, height: 844, channels: 3, background: "#000" } }).composite(imgs.map((b, j) => ({ input: b, left: j * 398, top: 0 }))).jpeg({ quality: 70 }).toFile(sheet);
      console.log("sheet", sheet, part.map((f) => path.basename(f)).join(" "));
    }
  }
  await close();
  console.log(errors.length ? "page errors:\n" + errors.join("\n") : "no page errors");
})().catch((e) => { console.error(e); process.exit(1); });
