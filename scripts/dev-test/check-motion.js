// Dev-only test bank: motion on the league-tabs surfaces (docs/PLAN-league-tabs.md, the animate + delight pass).
// Needs npm run dev.
//
//   node scripts/dev-test/check-motion.js <outDir> [width] [--dark] [--part=strip,sheet,tap,upnext,lineup,reduce,apply] [--keep]
//
// Brings up-next-fixture.js (the linked "Couch Crew" group: Classic, Active Roster, Pool) and signs in as its
// zt_tester, with the test browser recording every animation and transition that starts (motion.js). Prints
// PASS/FAIL per check and exits non-zero on a FAIL. Parts (all by default):
//   strip   the league strip's pill moves with transform only, over 220ms, starting within 100ms of the tap; mid-flight
//           the pill travels while its ink labels stay put; at rest each ink label sits exactly on its chip.
//   sheet   the More sheet and the league menu slide with transform, 200ms, and nothing animates a layout property.
//   tap     a real touch on a tab lights it within 100ms, before its page has loaded.
//   upnext  a cold load plays no cue; "+N more" opens with rows rising in; the count rises when a move clears.
//   lineup  setting the lineup then going to Overview plays "All set"'s tag slide once (not again on the next visit);
//           un-setting it brings the tab's "!" in with badge-in, and a cold load of that page doesn't.
//   reduce  with prefers-reduced-motion nothing moves (only opacity may animate): strip, sheets, lists, "!".
//   apply   (results-fixture.js, --staged) the commissioner's Apply lands on the episode page with its "Applied"
//           plate, which rises in once; takes that fixture down at the end unless --keep.
// Every animation seen, whatever the part, must touch only transform and opacity (the house rule): a part that
// sees `left`, `clip-path`, `height`... fails. Writes <outDir>/motion-<name>-<width>[-dark].png. All rows are zt-*:
// the up-next world and the results fixture are taken down at the end unless --keep. Nothing touches a real league.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const world = require("./up-next-fixture");
const results = require("./results-fixture");

const CUES = new Set(["chat-in", "tag-slide", "badge-in"]);
// Tailwind 4 slides with the individual `translate` property, not `transform`: both are the compositor's.
const moves = (x) => x.props.some((p) => p === "transform" || p === "translate");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-motion.js <outDir> [width] [--dark] [--part=a,b] [--keep]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const suffix = `${width}${dark ? "-dark" : ""}`;
  const only = (flags.find((f) => f.startsWith("--part=")) || "").slice(7).split(",").filter(Boolean);
  const run = (p) => !only.length || only.includes(p);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let fails = 0;
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    if (!ok) fails++;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cuesIn = (list) => list.filter((a) => CUES.has(a.name));
  // The house rule: only transform and opacity. The app's older plain colour transitions (transition-colors on a
  // button, the header over art) are paint-only and not this pass's; they're listed as a note, never failed.
  const COLOURS = /(^|-)color$|^(fill|stroke)$/;
  const houseRule = (m, list, name) => {
    const off = m.offProps(list);
    const bad = off.filter((a) => a.props.some((p) => !COLOURS.test(p) && !["transform", "opacity", "translate"].includes(p)));
    const colours = off.filter((a) => !bad.includes(a));
    check(`${name}: only transform and opacity animate`, bad.length === 0, bad.map((a) => `${a.target} ${a.props.join("+")}`).slice(0, 3).join("; "));
    if (colours.length) console.log(`      note: ${colours.length} older colour transition(s) seen: ${[...new Set(colours.map((a) => a.props.join("+")))].join(", ")}`);
  };
  let live = null; // the session in use, so a failure can say what the page threw
  // Also hides Next's dev "N" badge, which sits over the Overview tab and swallows a tap on it.
  const seedPage = (page) =>
    page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
      document.addEventListener("DOMContentLoaded", () => {
        const el = document.createElement("style");
        el.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(el);
      });
    }, dark ? "dark" : "light");

  try {
    if (only.length === 0 || only.some((p) => p !== "apply")) {
      const { classic, roster } = await world.up(pool, {});

      // One session per motion mode; the same walk helpers.
      const session = async (motion) => {
        const s = await open({ user: world.USERNAME, pass: world.PASSWORD, width, motion, watch: true });
        await seedPage(s.page);
        const { page, BASE } = s;
        const go = async (league, path = "/") => {
          await page.goto(`${BASE}${path}?league=${league.leagueId}`, { waitUntil: "networkidle" });
          await sleep(1200);
          const g = page.locator("button", { hasText: /Let.s go!/ });
          if (await g.count()) await g.first().click().catch(() => {});
          await sleep(400);
        };
        live = s;
        return { ...s, go };
      };

      if (run("strip") || run("sheet") || run("tap") || run("upnext") || run("lineup")) {
        const { page, errors, motion: m, go, close } = await session("on");
        const geo = () =>
          page.evaluate(() => {
            const g = document.querySelector("header [role=group]");
            const rect = (el) => el.getBoundingClientRect();
            const pill = g.querySelector(":scope > div[aria-hidden]");
            const inner = pill.firstElementChild;
            return {
              chips: [...g.querySelectorAll(":scope > button")].map((b) => rect(b).left),
              pill: rect(pill).left,
              pillW: rect(pill).width,
              chipW: rect(g.querySelector(":scope > button")).width,
              labels: [...inner.children].map((c) => rect(c).left),
              inner: rect(inner).left,
            };
          });
        const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

        if (run("strip")) {
          console.log("\n-- strip");
          await go(classic, "/");
          let g = await geo();
          check("strip: at rest, the pill sits on the open chip", near(g.pill, g.chips[0]) && near(g.pillW, g.chipW));
          check("strip: at rest, every ink label sits on its chip", g.labels.every((l, i) => near(l, g.chips[i])));
          await m.clear();
          const t0 = await page.evaluate(() => performance.now());
          await page.locator("header [role=group] button", { hasText: "Active Roster" }).first().click();
          await sleep(30);
          const a = await geo();
          await sleep(40);
          const b = await geo();
          // Early in a 220ms ease-out, so it has left the first chip and not yet reached the second.
          check("strip: mid-flight the pill is travelling", b.pill - a.pill > 0.5 && b.pill < g.chips[1] - 0.5 && a.pill > g.chips[0] + 0.5, `${a.pill.toFixed(1)} -> ${b.pill.toFixed(1)}`);
          check("strip: mid-flight the ink labels stay put", near(a.inner, g.inner, 1) && near(b.inner, g.inner, 1), `layer at ${a.inner.toFixed(1)}, ${b.inner.toFixed(1)}`);
          await page.screenshot({ path: `${out}/motion-strip-mid-${suffix}.png`, clip: { x: 0, y: 0, width, height: 130 } }).catch(() => {});
          await sleep(1500);
          const seen = await m.seen();
          g = await geo();
          check("strip: it lands on the tapped chip", near(g.pill, g.chips[1]) && near(g.pillW, g.chipW));
          check("strip: and every ink label is back on its chip", g.labels.every((l, i) => near(l, g.chips[i])));
          const slide = seen.filter((x) => x.props.join() === "transform" && x.ms === 220);
          check("strip: the pill slid with a 220ms transform transition", slide.length >= 2, JSON.stringify(seen.map((x) => `${x.target} ${x.props} ${x.ms}`)));
          if (slide.length) check("strip: and it started within 100ms of the tap", slide[0].at - t0 < 100, `${(slide[0].at - t0).toFixed(0)}ms`);
          houseRule(m, seen, "strip");
        }

        if (run("sheet")) {
          console.log("\n-- sheets");
          await go(classic, "/");
          await m.clear();
          await page.locator("[data-mobile-tabbar] button", { hasText: "More" }).click();
          await sleep(500);
          let seen = await m.seen();
          const more = seen.filter(moves);
          check("sheet: the More sheet slides with transform, 200ms", more.some((x) => x.ms === 200), JSON.stringify(more.map((x) => x.ms)));
          await page.screenshot({ path: `${out}/motion-more-${suffix}.png` });
          await page.evaluate(() => document.querySelector("div.fixed.inset-0.pointer-events-auto")?.click());
          await sleep(400);
          await m.clear();
          await page.locator("header [data-tour=header-league]").first().click();
          await sleep(500);
          seen = await m.seen();
          const menu = seen.filter(moves);
          check("sheet: the league menu slides with transform, 200ms", menu.some((x) => x.ms === 200), JSON.stringify(menu.map((x) => x.ms)));
          houseRule(m, seen, "sheet");
          await page.keyboard.press("Escape");
          await sleep(400);
        }

        if (run("tap")) {
          console.log("\n-- tap response");
          await go(classic, "/");
          // A real tap (touch down and up). The tapped tab lights at once, before its page has loaded: :active on a
          // touchscreen waits ~100ms in the browser, so it is not what answers a tap.
          const tab = page.locator("[data-mobile-tabbar] button:nth-child(2)");
          const box = await tab.boundingBox();
          check("tap: the Episodes tab isn't lit yet", !(await tab.evaluate((n) => n.classList.contains("text-chyron-line"))));
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(50);
          check("tap: it lights within 100ms of the tap", await tab.evaluate((n) => n.classList.contains("text-chyron-line")));
          await sleep(1500);
          check("tap: and the page it opened agrees", new URL(page.url()).pathname === "/episodes");
        }

        if (run("upnext")) {
          console.log("\n-- up next");
          await go(classic, "/");
          check("upnext: a cold load plays no cue", cuesIn(await m.seen()).length === 0, JSON.stringify(cuesIn(await m.seen()).map((x) => x.target)));
          await m.clear();
          const more = page.locator("[data-up-next] button[aria-expanded]").last();
          await more.click();
          await sleep(400);
          let seen = cuesIn(await m.seen());
          const rows = await page.locator("[data-up-next] ul li").count();
          check("upnext: '+N more' opens with each row rising in", rows > 0 && seen.filter((x) => x.target.startsWith("li")).length === rows, `${seen.length} cues, ${rows} rows`);
          await page.locator("[data-up-next]").screenshot({ path: `${out}/motion-more-list-${suffix}.png` }).catch(() => {});
          await more.click();
          await m.clear();
          const count = () => page.locator("[data-up-next] button[aria-expanded] span").first().innerText();
          const before = await count();
          await page.locator('input[aria-label^="Your guess"]').first().fill("zt guess");
          await page.locator("main button", { hasText: /^Guess$/ }).first().click();
          await sleep(500);
          const after = await count();
          seen = cuesIn(await m.seen());
          check("upnext: the count changes when a move clears", before !== after, `${before} -> ${after}`);
          check("upnext: and it rises into place (6px, 160ms)", seen.some((x) => x.target.startsWith("span.type-num") && x.ms === 160), JSON.stringify(seen.map((x) => `${x.target} ${x.ms}`)));
          houseRule(m, await m.seen(), "upnext");
        }

        if (run("lineup")) {
          console.log("\n-- lineup, All set, the tab's !");
          await go(roster, "/lineup");
          const badge = () => page.locator("[data-mobile-tabbar] button", { hasText: "Lineup" }).locator("span span").count();
          check("lineup: a cold load plays no cue (the tab's ! is there already)", (await badge()) === 1 && cuesIn(await m.seen()).length === 0);
          for (let i = 0; i < 3; i++) {
            const start = page.locator("main button", { hasText: /^Start$/ });
            if (!(await start.count())) break;
            await start.first().click();
            await sleep(400);
          }
          check("lineup: setting it clears the tab's !", (await badge()) === 0);
          await m.clear();
          await page.locator("[data-mobile-tabbar] button", { hasText: "Overview" }).click();
          await sleep(120);
          await page.locator("[data-up-next]").screenshot({ path: `${out}/motion-all-set-mid-${suffix}.png` }).catch(() => {});
          await sleep(500);
          let seen = await m.seen();
          const tag = seen.filter((x) => x.name === "tag-slide");
          check("lineup: 'All set' slides its tag in (260ms, transform)", tag.length === 1 && tag[0].ms === 260 && tag[0].props.join() === "transform", JSON.stringify(tag.map((x) => `${x.ms} ${x.props}`)));
          check("lineup: and the plate says so", /all set/i.test(await page.locator("[data-up-next] [role=status]").first().innerText()));
          await page.locator("[data-up-next]").screenshot({ path: `${out}/motion-all-set-${suffix}.png` }).catch(() => {});
          await m.clear();
          await page.locator("[data-mobile-tabbar] button", { hasText: "Episodes" }).click();
          await sleep(500);
          await page.locator("[data-mobile-tabbar] button", { hasText: "Overview" }).click();
          await sleep(600);
          check("lineup: it plays once, not on the next visit to Overview", (await m.seen()).filter((x) => x.name === "tag-slide").length === 0);
          await page.locator("[data-mobile-tabbar] button", { hasText: "Lineup" }).click();
          await sleep(1800);
          await m.clear();
          await page.locator("main .grid.grid-cols-3 button").first().click();
          await sleep(500);
          seen = await m.seen();
          const pop = seen.filter((x) => x.name === "badge-in");
          check("lineup: benching a starter brings the ! in (160ms, transform + opacity)", (await badge()) === 1 && pop.length === 1 && pop[0].ms === 160 && pop[0].props.sort().join() === "opacity,transform", JSON.stringify(pop.map((x) => `${x.ms} ${x.props}`)));
          await page.screenshot({ path: `${out}/motion-badge-${suffix}.png` });
          houseRule(m, seen, "lineup");
        }
        if (errors.length) console.log("page errors:", errors.slice(0, 5));
        await close();
      }

      if (run("reduce")) {
        console.log("\n-- reduced motion");
        const { page, errors, motion: m, go, close } = await session("reduce");
        check("reduce: the browser reports prefers-reduced-motion", await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
        await go(classic, "/");
        await page.locator("header [role=group] button", { hasText: "Active Roster" }).first().click();
        await sleep(1500);
        await page.locator("[data-mobile-tabbar] button", { hasText: "More" }).click();
        await sleep(500);
        await page.evaluate(() => document.querySelector("div.fixed.inset-0.pointer-events-auto")?.click());
        await sleep(400);
        await go(roster, "/");
        await page.locator("[data-up-next] button[aria-expanded]").last().click();
        await sleep(400);
        await go(roster, "/lineup");
        // Fill the lineup (whatever's left to start), then bench one: the tab's ! turns up.
        for (let i = 0; i < 3; i++) {
          const start = page.locator("main button", { hasText: /^Start$/ });
          if (!(await start.count())) break;
          await start.first().click();
          await sleep(400);
        }
        await page.locator("main .grid.grid-cols-3 button").first().click();
        await sleep(500);
        check("reduce: and the ! did turn up (state changes are still shown)", (await page.locator("[data-mobile-tabbar] button", { hasText: "Lineup" }).locator("span span").count()) === 1);
        const seen = await m.seen();
        const moving = seen.filter((x) => x.props.some((p) => p !== "opacity"));
        check("reduce: nothing moves (strip, sheets, lists, tab !)", moving.length === 0, moving.map((x) => `${x.target} ${x.props}`).slice(0, 4).join("; "));
        if (errors.length) console.log("page errors:", errors.slice(0, 5));
        await close();
      }
    }

    if (run("apply")) {
      console.log("\n-- apply results");
      await world.down(pool);
      await results.up(pool, ["--staged", "--when=aired"]);
      const { rows } = await pool.query(`SELECT id FROM leagues WHERE slug = 'zt-res-classic'`);
      const lg = rows[0]?.id;
      if (!lg) throw new Error("results-fixture made no zt-res-classic league");
      const s = await open({ user: "zt_comm", pass: "zt-pass-12345", width, motion: "on", watch: true });
      await seedPage(s.page);
      const { page, BASE, motion: m } = s;
      await page.goto(`${BASE}/episodes/4/research?league=${lg}`, { waitUntil: "networkidle" });
      await sleep(1200);
      const btn = page.locator("button", { hasText: /^Apply \d+/ }).last();
      check("apply: the Apply button is there", (await btn.count()) > 0);
      await m.clear();
      await btn.click();
      await page.waitForURL(/\/episodes\/4$/, { timeout: 15000 });
      await sleep(500);
            check("apply: the episode page confirms what went in", /\d+ results? in your league/i.test(await page.locator("main").innerText()));
      const seen = await m.seen();
      const rise = seen.filter((x) => x.name === "chat-in");
      check("apply: the plate rises in once", rise.length === 1 && rise[0].ms === 220, JSON.stringify(rise.map((x) => x.ms)));
      await page.screenshot({ path: `${out}/motion-applied-${suffix}.png` });
      houseRule(m, seen, "apply");
      await page.reload({ waitUntil: "networkidle" });
      await sleep(800);
      check("apply: a reload doesn't show it again", !/results? in your league/i.test(await page.locator("main").innerText()));
      if (s.errors.length) console.log("page errors:", s.errors.slice(0, 5));
      await s.close();
    }
  } catch (e) {
    if (live) console.log("what the page threw:", live.errors.slice(0, 6));
    throw e;
  } finally {
    if (!flags.includes("--keep")) {
      await world.down(pool);
      await results.down(pool);
    }
    await pool.end();
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
