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
//
// Walks: each game's Overview (prints the control room, the plate and the count), opens "+N more" on Classic
// (prints the rows), taps the Active Roster row (should land on its Lineup) and, as commissioner, taps the
// control room (should land on Pool's episode 7). Writes <outDir>/upnext-<step>-<width>[-dark].png and prints
// page errors. Takes the fixture down at the end unless --keep. Nothing here touches a real league: it's all zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");
const S = require("../../src/lib/game/state-logic.js");

const SEASON_NAME = "zt-up-next";
const HOUR = 3_600_000;

// A weekly season whose episode 7 airs at `at` (UTC): premiere six weeks before, same time of day.
function seasonFor(at) {
  const d = new Date(at.getTime() - 42 * 24 * HOUR);
  return { premiere: d.toISOString().slice(0, 10), time: at.toISOString().slice(11, 16) };
}

async function seasonsDown(pool) {
  await pool.query(`DELETE FROM show_seasons WHERE name = $1`, [SEASON_NAME]);
}

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
    const [classic, roster, pickem] = await fixture.up(pool, { groupName: "Couch Crew" });
    await seasonsDown(pool);
    const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug = 'survivor'`);
    const now = Date.now();
    const plan = [
      [classic, 99, new Date(now + 30 * HOUR)],
      [roster, 98, new Date(now + 3 * HOUR)],
      [pickem, 97, new Date(now + (clear ? 50 : -2) * HOUR)],
    ];
    for (const [league, season, at] of plan) {
      const { premiere, time } = seasonFor(at);
      await pool.query(
        `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz) VALUES ($1,$2,$3,'airing',$4,$5,'UTC')`,
        [show[0].id, season, SEASON_NAME, premiere, time]
      );
      const { rows } = await pool.query(`SELECT state FROM leagues WHERE id = $1`, [league.leagueId]);
      const state = rows[0].state;
      state.settings.wikiSeason = season;
      const me = state.players[0].id;
      const ep7 = state.episodes.find((e) => e.number === 7);
      if (league === classic && !clear) {
        state.settings.bonusEnabled = true;
        S.addBet(state, ep7.id, "Who wins immunity?", 1, me);
      }
      if (league === roster) {
        // Explicitly empty: with none set, last week's lineup carries over.
        ep7.lineups = { ...ep7.lineups, [me]: [] };
        if (clear) {
          const mine = state.castaways.filter((c) => c.ownerIds.includes(me) && c.status !== "eliminated").map((c) => c.id);
          S.setActiveRosterLineup(state, ep7.id, me, mine.slice(0, S.ActiveRosterLogic.activeSlots(state)));
        }
      }
      if (league === pickem && clear) {
        const { available } = S.pickEmEligibility(state, ep7.id, me);
        if (available.length) S.setPickEmPick(state, ep7.id, me, available[0]);
      }
      // Waivers off, so the fixture's week owes nobody a replacement.
      if (clear) Object.assign(state.settings, { replaceRule: "never", waiverWindows: { schedule: "manual", every: 3, swaps: 0 } });
      await pool.query(`UPDATE leagues SET state = $2 WHERE id = $1`, [league.leagueId, JSON.stringify(state)]);
      await pool.query(`UPDATE league_memberships SET results_seen_through = $2, role = $3 WHERE league_id = $1`, [
        league.leagueId,
        seen,
        member ? "member" : "commissioner",
      ]);
    }
    const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
    await pool.query(
      `INSERT INTO user_settings (user_id, whats_new_seen) SELECT id, $2 FROM "user" WHERE username=$1
       ON CONFLICT (user_id) DO UPDATE SET whats_new_seen = $2`,
      [fixture.USERNAME, LATEST_RELEASE_ID]
    );

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
    if (!flags.includes("--keep")) {
      await fixture.down(pool);
      await seasonsDown(pool);
    }
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
