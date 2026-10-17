// Dev-only test bank: Up next and the control room on Overview (docs/PLAN-league-tabs.md, build step 4).
// Needs npm run dev.
//
//   node scripts/dev-test/check-up-next.js <outDir> [width] [--dark] [--member] [--clear] [--seen=N] [--pages] [--keep]
//
// Brings linked-fixture.js up (Classic, Active Roster, Pool, named "Couch Crew"), then gives each league its own
// made-up season (Survivor 97-99, show_seasons rows named "zt-up-next") so episode 7 has a real air time, which
// the server stamps from the schedule:
//   - Active Roster: episode 7 airs in 3 hours with your lineup empty  -> "Lineup", due soon (chyron-line)
//   - Classic: episode 7 airs in 30 hours, with a prediction to guess   -> "Predict", not soon
//   - Pool: episode 7 aired 2 hours ago with no results                -> no pick; a commissioner's results job
// --member: the tester plays in all three but runs none (no control room). --clear: the lineup set, no
// prediction, Pool's episode 7 still to air with a pick in, waivers off (nothing to do anywhere but the
// commissioner's jobs; with --member, nothing at all). --seen=N: the tester's reveal mark (default 6, everything revealed, so the
// status plate shows; 4 hides episodes 5-6 behind the reveal).
// --pages (step 7): also walks Up next across the other pages of each game -- Team, Scoreboard, Episodes, Lineup,
// Research, Pick -- printing what each shows. Up next is on all of them (the count and the control room too), except:
// Team / Lineup when a waiver banner leads them, Episodes for this league's own results job (its lead), and a to-do
// that points at the page you're on. The quiet "Nothing to do in X / Next: ..." plate is Overview's alone.
// --focus: Tabs through Up next and prints each stop's focus outline (keyboard ring check).
//
// Walks: each game's Overview (prints the control room, the plate and the count), opens "+N more" on Classic
// (prints the rows), taps the Active Roster row (should land on its Lineup) and, as commissioner, taps the
// control room (should land on Pool's episode 7). Writes <outDir>/upnext-<step>-<width>[-dark].png and prints
// page errors. Takes the fixture down at the end unless --keep. Nothing here touches a real league: it's all zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

const world = require("./up-next-fixture");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-up-next.js <outDir> [width] [--dark] [--member] [--clear] [--seen=N] [--keep]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const member = flags.includes("--member");
  const clear = flags.includes("--clear");
  const seen = parseInt((flags.find((f) => f.startsWith("--seen=")) || "--seen=6").slice(7), 10);
  const suffix = `${width}${dark ? "-dark" : ""}${member ? "-member" : ""}${clear ? "-clear" : ""}`;
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const { classic, roster, pickem } = await world.up(pool, { clear, member, seen });
    const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");

    async function settle() {
      await page.waitForTimeout(900);
      const go = page.locator("button", { hasText: /Let.s go!/ });
      if (await go.count()) await go.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    const go = async (league, path = "/") => {
      await page.goto(`${BASE}${path}?league=${league.leagueId}`, { waitUntil: "networkidle" });
      await settle();
    };
    async function report(step) {
      const said = await page.evaluate(() => {
        const up = document.querySelector("[data-up-next]");
        const text = (el) => (el ? el.innerText.replace(/\s*\n+\s*/g, " / ") : null);
        const ctrl = up?.querySelector("[data-control-room]");
        const plate = up?.querySelector("[role=status]");
        const rows = [...(up?.querySelectorAll("ul li") ?? [])].map(text);
        const open = document.querySelector("header [role=group] button[aria-pressed=true]")?.getAttribute("aria-label");
        // The pager that's left (an invite, the notifications nudge) is a [role=status] outside Up next.
        const pager = [...document.querySelectorAll("main [role=status]")].filter((el) => !up?.contains(el)).map(text);
        return { path: location.pathname, open, control: text(ctrl?.firstElementChild), plate: text(plate), rows, pager };
      });
      console.log(`\n${step}  ${said.path}  (open: ${said.open ?? "?"})`);
      console.log(`  control room: ${said.control ?? "(none)"}`);
      console.log(`  plate:        ${said.plate ?? "(none)"}`);
      if (said.pager.length) console.log(`  pager:        ${said.pager.join(" | ")}`);
      for (const r of said.rows) console.log(`    · ${r}`);
      const up = page.locator("[data-up-next]");
      if (said.path === "/" && (await up.count())) await up.screenshot({ path: `${out}/upnext-${step}-${suffix}.png` });
      else await page.screenshot({ path: `${out}/upnext-${step}-${suffix}.png` });
      return said;
    }

    await go(classic);
    await report("classic");
    // Light touch 4: Overview's Your team (Classic) has the Team tab as its one heading link; the Team page itself has none.
    const yours = page.locator("main h3, main [data-slot=card-title]", { hasText: /^Your Team$/i }).first();
    if (await yours.count()) {
      const link = await yours.locator("xpath=ancestor::*[contains(@class,'flex-row')][1]//a").first().getAttribute("href").catch(() => null);
      console.log(`\n  Your Team heading link: ${link ?? "(none)"}`);
      await yours.locator("xpath=../..").screenshot({ path: `${out}/upnext-your-team-${suffix}.png` }).catch(() => {});
    } else console.log("\n  Your Team heading: not found");
    const more = page.locator("[data-up-next] button[aria-expanded]").last();
    if (await more.count()) {
      await more.click();
      await page.waitForTimeout(300);
      await report("classic-more");
      const row = page.locator("[data-up-next] ul li button", { hasText: "Active Roster" }).first();
      if (await row.count()) {
        await row.click();
        await page.waitForTimeout(2000);
        await report("row-to-roster");
      }
    }
    await go(roster);
    await report("roster");
    await go(pickem);
    await report("pool");
    await page.screenshot({ path: `${out}/upnext-pool-screen-${suffix}.png` });
    if (!member) {
      await go(classic);
      const ctrl = page.locator("[data-control-room] button").first();
      if (await ctrl.count()) {
        await ctrl.click();
        await page.waitForTimeout(2000);
        await report("control-room-tap");
      }
    }
    if (flags.includes("--focus")) {
      // Keyboard: Tab through Up next on Classic's Overview; every stop must draw a visible focus ring (an
      // inset outline: the plates clip their own overflow). Prints each stop's outline and shoots the first.
      await go(classic);
      await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
      let stops = 0;
      for (let i = 0; i < 40 && stops < 6; i++) {
        await page.keyboard.press("Tab");
        const at = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || !el.closest("[data-up-next]")) return null;
          const cs = getComputedStyle(el);
          return { what: (el.innerText || "").split("\n").join(" / ").slice(0, 40), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` };
        });
        if (!at) continue;
        stops++;
        console.log(`  focus ${stops}: ${at.what}  ->  ${at.outline}`);
        if (stops === 1) await page.locator("[data-up-next]").screenshot({ path: `${out}/upnext-focus-${suffix}.png` });
      }
      if (!stops) console.log("  focus: no stop inside Up next");
    }
    if (flags.includes("--pages")) {
      const tour = [
        [classic, "/team", "classic-team"],
        [classic, "/scoreboard", "classic-scoreboard"],
        [classic, "/episodes", "classic-episodes"],
        [roster, "/lineup", "roster-lineup"],
        [roster, "/research", "roster-research"],
        [pickem, "/episodes", "pool-episodes"],
        [pickem, "/pick", "pool-pick"],
        [pickem, "/research", "pool-research"],
      ];
      for (const [league, path, step] of tour) {
        await go(league, path);
        await report(`page-${step}`);
      }
    }
    if (errors.length) console.log("\nerrors:", errors.slice(0, 5));
    await close();
  } finally {
    if (!flags.includes("--keep")) await world.down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
