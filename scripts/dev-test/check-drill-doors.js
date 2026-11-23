// Dev-only check of the drill pass's doors (docs/design-round/drill-audit.md): each face, name or row that now opens a level is
// tapped as someone on a zt couch, and the level it opens must appear over the surface; then the phone's back (the browser's,
// page.goBack(): sheet-history.ts) must take down that level alone, the surface still there as it was, and where the door opened
// a sheet over a sheet, a second back the one under it (one level a back, the same everywhere: the user, 2026-11-17).
// Frames before the tap, after it and after the back (<out>/<door>.before.jpg, .after.jpg, .back.jpg), for the round's
// screenshot story, and a PASS, FAIL or SKIP line each (BACK lines for the backs). Four sets (--set=couch,draft,waivers,sports,
// all four by default), each on its own fixture:
//
// couch: new-fixture.js's couch as alex (bring it up first: node scripts/dev-test/new-fixture.js up)
//   chat-face          the show's Chat: someone else's face opens them on the couch (couch/person-sheet.tsx)
//   rank-row           the hub's Power rankings: a row opens that person on the couch
//   h2h-row            the same page's Head to head: a row opens that person on the couch
//   bet-caller         a game page's Side bets: who called it opens their sheet in the game
//   matchup-head       a head-to-head matchup's two heads open each person in the game (SKIP: the test couch has no head to head)
//   morning-row        the final results' morning sheet: a standings row opens that person in the game (SKIP unless one is due)
//   tonight-out        Tonight's Last time: who left opens the castaway's sheet
//   tonight-ledger     Tonight's Your games, Who scored opened: a castaway opens their sheet in that game
//   episode-out        an episode's page (Episodes): who left opens the castaway's sheet
//   episode-winner     the same page's What happened: a person (not a tribe) opens their sheet
//   episode-scorer     the same page's game best this episode: a castaway opens their sheet in that game
//   lineup-title       Lineup League, alex's season sheet: a played week's title opens everyone's plays that week (the game's episode)
//   season-cell        the same sheet's season table, a number: that castaway's sheet led by that week (BACKLOG 251)
//   season-week        the same table's week heading: the lineup above turns to that week, in place (one back still takes the sheet)
//   table-cell         the game page's Everyone in this game, a number: that castaway's sheet led by that week (BACKLOG 251)
//   pool-pick          Survival Pool, alex's sheet, the night's pick: that castaway at that episode of their story
//   compare-week       a castaway's Compare with…, someone picked, a week's column: the heads read that week, in place
//   best-lineup        a matchup's "Best lineup … X for Y": the two side by side that week (SKIP: no head to head on the test couch)
//   story-night        a castaway's story, "Episode N ›": the night (the episode's page as a level) over their sheet
//   status-night       the castaway sheet's "Out · Ep N": the night they left
//   strip-story        Their numbers, a row opened, an episode in its strip: that episode of their story, in place
//   chat-episode       Chat's landmark for an episode alex has seen: the episode's page (a jump to Episodes), back to the chat
//   profile-place      the hub's profile, your place on the couch: the Power rankings page (the sheet closes; back lands on Home)
//   profile-called     the same profile's Called it: By the numbers
//   profile-finish     the same profile's best finish: that game's page (SKIP: no season over on the test couch)
//   po-last            the hub's Previously on, Last time: who left opens their sheet over the page (the night, when nobody left)
//   po-gone            the same page's The story so far: a face opens their sheet
//   po-still           the same page's Still in: a face opens their sheet
//   po-episode         the same page's Episode by episode: a row opens the night over the page
//
// draft: draft-fixture.js as alex, brought up here (Couch Cup's snake draft six picks in, alex up; the blind draft started), then
// again with every pick in; taken down at the end unless --keep
//   draft-taken        the room's board with Show taken on: someone else's tile opens their sheet, read-only ("Taken by …")
//   draft-slot         your slots under the clock: one you drafted opens their sheet ("On your team")
//   draft-board-cell   the Picks board: a pick's cell opens that castaway's sheet
//   draft-queue-row    your queue: a row opens their sheet, Draft at its foot (alex is up)
//   draft-blind-slot   Lineup League's blind draft: someone added to your team, then their slot opens their sheet (Take them out)
//   draft-done-cell    the draft done ("Couch Cup is set"): a cell on the board opens their sheet ("On …'s team")
//
// waivers: waivers-fixture.js --ui=new as Sam (zt_wplayer, owed a replacement for Jelly), brought up here phase by phase; taken
// down at the end unless --keep
//   waiver-spot        phase open: the spot plate's face (Jelly, out) opens her sheet
//   waiver-picker-face the claim picker: a free agent's photo opens their sheet over it (Pick at its foot), the picker under it
//   waiver-picker-pick the same sheet's Pick: back on the picker with that row chosen (nothing saved)
//   waiver-move-face   phase processed: Everyone's moves, the castaway someone got opens their sheet in the game
//   waiver-move-person the same row's person opens their sheet in the game
//   waiver-last-face   phase idle: Last time's castaway opens their sheet
//
// sports: a stand-in ESPN (fake-espn.js, by the x-gys-sports header: the real one is never asked), as alex (new-fixture.js up): a
// sport from TV listings that isn't a game yet (seeded as Add a show leaves one: no set_up_at, its three games linked) and the ZT
// Hawks' season added through Add a show's route (a league season, a game already); everything keyed on the stand-in league
// football/zt-ddf, taken down at the end unless --keep
//   roster-person      the TV sport's Players tab: an athlete opens their sheet
//   roster-team        the same tab's team heading: the team's sheet (its schedule, Follow, a game to play)
//   athlete-log        the Hawks' season's Cast tab, the QB, a game in his log: that game's sheet over his (two backs)
//   cast-team          the same season with a Pick'em on it, its Cast tab's team heading: the team's sheet
//
//   node scripts/dev-test/check-drill-doors.js [--set=couch,draft,waivers,sports] [--only=<regex>] [--keep]
//                                              [--out=.ui-atlas/stories/drill-doors/after] [--width=390 --height=844]
//
// Needs the dev server (npm run dev; BASE= for another). The couch set reads only; the draft and waivers sets write only their
// fixtures' zt-dr- / zt-wv- rows, the sports set only its stand-in league's (never run beside another check on the same fixture,
// nor the sports set beside check-sports-couch.js: both clear the stand-in's cache). Refuses a non-local database. A page error
// prints as a PAGEERROR line.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/drill-doors/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const SETS = opt("set", "couch,draft,waivers,sports").split(",");
const KEEP = args.includes("--keep");
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-drill-doors runs against a local database only");

const wait = (p, ms) => p.waitForTimeout(ms);
const dialogs = (p) => p.locator('[role="dialog"]');
const results = [];
const wanted = (id) => !ONLY || new RegExp(ONLY).test(id);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  let b = null;
  let p = null;
  /** A browser signed in as `user`, the one the doors below tap in (the last one closed). */
  async function as(user, pass = "zt-pass-12345", headers) {
    if (b) await b.close();
    b = await open({ user, pass, width: W, height: H, motion: "reduce", headers });
    p = b.page;
    p.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.split("\n")[0]}`));
    // The dev server's badge sits over a sheet's foot in the frames (story-waivers.js hides it the same way).
    await p.addInitScript(() => {
      const hide = () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }));
      if (document.head) hide();
      else document.addEventListener("DOMContentLoaded", hide);
    });
    // The fixtures' people are zt_ usernames, which a face draws its initial from: shown without the prefix, as story-numbers.js does.
    await p.route("**/api/**", async (route) => {
      const res = await route.fetch().catch(() => null);
      if (!res) return route.abort();
      if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
      return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_(?:nd|dr)_([a-z]+)"/g, '"$1"') });
    });
  }
  const shot = (id, part) => p.screenshot({ path: path.join(OUT, `${id}.${part}.jpg`), type: "jpeg", quality: 84 });
  const record = (id, verdict, why = "") => {
    results.push([id, verdict, why]);
    console.log(`${verdict} ${id}${why ? `: ${why}` : ""}`);
  };

  /** One door: `go` brings the surface up, `door` finds what to tap, `opened` is what must appear, `check` anything more about it
   *  (an error, or null); frames either side of the tap. */
  async function door(id, { go, door: find, opened, check, skip, under = 0, still }) {
    if (!wanted(id)) return;
    try {
      await go();
      const el = await find();
      if (!el || !(await el.count())) return record(id, "SKIP", skip ?? "nothing to tap");
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await wait(p, 500);
      await shot(id, "before");
      const was = await dialogs(p).count();
      await el.click();
      await opened(was);
      await wait(p, 900);
      await shot(id, "after");
      const wrong = check ? await check() : null;
      record(id, wrong ? "FAIL" : "PASS", wrong ?? "");
      // The phone's back: the level the door opened goes, nothing else; the surface (`still`) is there as it was.
      const url = p.url();
      await p.goBack();
      await wait(p, 900);
      const left = await dialogs(p).count();
      const ok = left === was && p.url() === url && (!still || (await p.locator(still).first().isVisible()));
      await shot(id, "back");
      results.push([`${id} back`, ok ? "PASS" : "FAIL", ok ? "" : `${left} sheets up (want ${was}), ${p.url()}`]);
      console.log(`${ok ? "BACK PASS" : "BACK FAIL"} ${id}${ok ? "" : `: ${left} sheets up (want ${was})`}`);
      // A sheet under it (the side bets under a caller's sheet): one more back takes that one down too, the page staying.
      if (ok && under) {
        await p.goBack();
        await wait(p, 900);
        const after = await dialogs(p).count();
        const ok2 = after === was - under && p.url() === url;
        results.push([`${id} back twice`, ok2 ? "PASS" : "FAIL", ok2 ? "" : `${after} sheets up (want ${was - under})`]);
        console.log(`${ok2 ? "BACK PASS" : "BACK FAIL"} ${id} twice${ok2 ? "" : `: ${after} sheets up (want ${was - under})`}`);
      }
    } catch (e) {
      record(id, "FAIL", e.message.split("\n")[0]);
    }
  }
  /** A step that isn't a door (an action at a sheet's foot): `run` returns an error, "SKIP: why", or null. */
  async function step(id, run) {
    if (!wanted(id)) return;
    try {
      const r = await run();
      if (r && r.startsWith("SKIP: ")) record(id, "SKIP", r.slice(6));
      else record(id, r ? "FAIL" : "PASS", r ?? "");
    } catch (e) {
      record(id, "FAIL", e.message.split("\n")[0]);
    }
  }
  const couchPerson = async () => p.locator("[data-person-sheet]").last().waitFor({ timeout: 15000 });
  const anotherSheet = async (was) => p.waitForFunction((n) => document.querySelectorAll('[role="dialog"]').length > n, was, { timeout: 15000 });
  const castSheet = async () => p.locator("[data-cast-sheet]").last().waitFor({ timeout: 20000 });

  try {
    if (SETS.includes("couch")) {
      const season = (await one(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'zt-nd-survivor' AND ss.season_number = 51`))?.id;
      const lineup = (await one(`SELECT id FROM leagues WHERE slug = 'zt-nd-lineup'`))?.id;
      const poolGame = (await one(`SELECT id FROM leagues WHERE slug = 'zt-nd-pool'`))?.id;
      if (!season || !lineup) throw new Error("new-fixture.js isn't up (no zt-nd season or Lineup League): node scripts/dev-test/new-fixture.js up, or --set=draft,waivers");
      await as("zt_nd_alex");
      await door("chat-face", {
        go: async () => {
          await p.goto(`${BASE}/show/${season}/chat`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-chat]").first().waitFor({ timeout: 45000 });
          await wait(p, 1500);
        },
        door: async () => p.locator("[data-msg] [data-door-person]").last(),
        opened: couchPerson,
        still: "[data-chat]",
      });
      // The couch's pages open over the hub by their ?page= (couch-pages.tsx).
      const rankings = async () => {
        await p.goto(`${BASE}/home?page=rankings`, { waitUntil: "domcontentloaded" });
        await p.locator('[data-couch-page="rankings"]').waitFor({ timeout: 45000 });
        await wait(p, 1000);
      };
      await door("rank-row", { go: rankings, door: async () => p.locator("[data-rank-row]:not(:disabled)").nth(1), opened: couchPerson, still: '[data-couch-page="rankings"]' });
      await door("h2h-row", {
        go: async () => {
          await rankings();
          await p.locator('[data-couch-page="rankings"] button:has-text("Head to head")').first().click();
          await wait(p, 700);
        },
        door: async () => p.locator("[data-h2h]:not(:disabled)").first(),
        opened: couchPerson,
        still: "[data-h2h]",
      });
      await door("bet-caller", {
        go: async () => {
          await p.goto(`${BASE}/show/${season}/game/${lineup}`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
          await wait(p, 1200);
          const row = p.locator("[data-side-bets-row]").first();
          if (await row.count()) {
            await row.click();
            await dialogs(p).last().waitFor({ timeout: 12000 });
            await wait(p, 900);
          }
        },
        door: async () => p.locator('[role="dialog"] [data-call-of] [data-door-person]:not(:disabled)').first(),
        opened: anotherSheet,
        under: 1,
        still: "[data-bet]",
        skip: "no side bet with calls on the test couch",
      });
      await door("matchup-head", {
        go: async () => {},
        door: async () => p.locator("[data-matchup-head] [data-door-person]").first(),
        opened: anotherSheet,
        skip: "the test couch has no head-to-head game (the bench's pilot has one)",
      });
      await door("morning-row", {
        go: async () => {},
        door: async () => p.locator("[data-morning-row]").first(),
        opened: anotherSheet,
        skip: "no final results due on the test couch",
      });
      // Castaways wherever they appear (the drill pass's step 2): each opens the one castaway sheet over the page, back to the page.
      const tonight = async () => {
        await p.goto(`${BASE}/show/${season}/tonight`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-last-time], [data-mini-ledger]").first().waitFor({ timeout: 45000 });
        await wait(p, 1200);
      };
      await door("tonight-out", { go: tonight, door: async () => p.locator("[data-last-out][data-door-cast]").first(), opened: castSheet, still: "[data-last-time]", skip: "nobody left in the episode Tonight shows" });
      await door("tonight-ledger", {
        go: async () => {
          await tonight();
          const t = p.locator('[data-mini-ledger="closed"]').first();
          if (await t.count()) {
            await t.scrollIntoViewIfNeeded();
            await t.click();
            await wait(p, 600);
          }
        },
        door: async () => p.locator("[data-ledger-row][data-door-cast]").first(),
        opened: castSheet,
        still: "[data-ledger]",
        skip: "no Who scored on Tonight",
      });
      const episode = async () => {
        await p.goto(`${BASE}/show/${season}/episodes?page=ep5`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-episode-page]").first().waitFor({ timeout: 45000 });
        await wait(p, 1200);
      };
      await door("episode-out", { go: episode, door: async () => p.locator("[data-episode-page] > div [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "nobody left in Episode 5" });
      await door("episode-winner", { go: episode, door: async () => p.locator("[data-ep-happened] [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "no person in What happened" });
      await door("episode-scorer", { go: episode, door: async () => p.locator("[data-ep-scorers] [data-door-cast]").first(), opened: castSheet, still: "[data-episode-page]", skip: "no best this episode" });

      // A game's weeks and numbers (step 3): Lineup League's page, alex's own season sheet (a lineup and the season under it).
      const gamePage = async () => {
        await p.goto(`${BASE}/show/${season}/game/${lineup}`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
        await wait(p, 1200);
      };
      const yourSheet = async () => {
        await gamePage();
        await p.locator("[data-door-you]").first().click();
        await p.locator("[data-sheet-player]").last().waitFor({ timeout: 15000 });
        await wait(p, 900);
      };
      const storyAt = (sel, attr) => async () => {
        // The castaway's sheet opened at that episode: their story's episode in view (the story runs newest first, so its first
        // episode can only come up as far as the sheet's end allows).
        const v = await p.locator(sel).first().getAttribute(attr);
        const n = v?.includes(":") ? v.split(":")[1] : v;
        const box = await p.locator(`[data-cast-sheet] [data-story-ep="${n}"]`).last().boundingBox({ timeout: 5000 }).catch(() => null);
        return box && box.y > 0 && box.y + 24 < H ? null : `Episode ${n} of their story isn't in view (${box ? Math.round(box.y) : "missing"})`;
      };
      // A number in a game that scores people week by week (BACKLOG 251): the castaway's sheet leads with that week, at its top.
      const weekAt = (sel, attr) => async () => {
        const n = (await p.locator(sel).first().getAttribute(attr))?.split(":")[1];
        const box = await p.locator(`[data-cast-sheet] [data-week-block="${n}"]`).last().boundingBox({ timeout: 5000 }).catch(() => null);
        return box && box.y > 0 && box.y < H / 2 ? null : `Episode ${n}'s week isn't leading the sheet (${box ? Math.round(box.y) : "missing"})`;
      };
      // The one of several in view (a pager keeps every week's pane in the page, side by side).
      const inView = async (loc) => {
        for (let i = 0; i < (await loc.count()); i++) {
          const b = await loc.nth(i).boundingBox();
          if (b && b.x >= 0 && b.x < W && b.y >= 0 && b.y < H) return loc.nth(i);
        }
        return null;
      };
      await door("lineup-title", {
        go: yourSheet,
        door: async () => inView(p.locator("[data-sheet-player] [data-week-pane] [data-door-episode]")),
        opened: async () => p.locator("[data-episode-sheet]").last().waitFor({ timeout: 15000 }),
        still: "[data-sheet-player]",
        skip: "no played week in alex's lineup",
      });
      await door("season-cell", { go: yourSheet, door: async () => p.locator("[data-season-cell]").first(), opened: castSheet, check: weekAt("[data-season-cell]", "data-season-cell"), still: "[data-sheet-player]", skip: "no numbers in alex's season" });
      // A week's heading changes the sheet in place (no new level): the lineup turns to it, and one back still takes the sheet.
      await step("season-week", async () => {
        await yourSheet();
        const heads = p.locator("[data-season-week]");
        if ((await heads.count()) < 2) return "SKIP: fewer than two weeks in alex's season";
        const h = heads.first();
        const n = await h.getAttribute("data-season-week");
        const was = await dialogs(p).count();
        await h.scrollIntoViewIfNeeded();
        await shot("season-week", "before");
        await h.click();
        await wait(p, 900);
        await shot("season-week", "after");
        if ((await dialogs(p).count()) !== was) return "a week's heading opened a level";
        if ((await h.getAttribute("aria-pressed")) !== "true") return `Ep ${n}'s heading isn't marked as the week shown`;
        const pane = await p.locator(`[data-sheet-player] [data-week-pane="${n}"]`).first().boundingBox();
        if (!pane || pane.y < 0 || pane.y > H) return `the lineup didn't come to Ep ${n} in view`;
        await p.goBack();
        await wait(p, 900);
        await shot("season-week", "back");
        return (await dialogs(p).count()) === was - 1 ? null : "back didn't take the sheet the week changed in";
      });
      await door("table-cell", {
        go: async () => {
          await gamePage();
          await p.locator('[data-game-page] button:has-text("Everyone in this game")').first().click();
          await p.locator("[data-game-table]").last().waitFor({ timeout: 15000 });
          await wait(p, 900);
        },
        door: async () => p.locator("[data-game-table] [data-table-cell]").first(),
        opened: castSheet,
        check: weekAt("[data-game-table] [data-table-cell]", "data-table-cell"),
        still: "[data-game-table]",
      });
      // A pick in Survival Pool's night (no game arithmetic for one castaway): their sheet lands on that episode of their story.
      await door("pool-pick", {
        go: async () => {
          await p.goto(`${BASE}/show/${season}/game/${poolGame}`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
          await wait(p, 1200);
          await p.locator("[data-door-you]").first().click();
          await p.locator("[data-sheet-player]").last().waitFor({ timeout: 15000 });
          await wait(p, 900);
        },
        door: async () => p.locator('[role="dialog"] [data-episode-block] [data-door-cast]').first(),
        opened: castSheet,
        check: storyAt('[role="dialog"] [data-episode-block]', "data-episode-block"),
        still: "[data-sheet-player]",
        skip: "no pick in alex's pool night",
      });
      // A compare's week: a castaway's Compare with…, someone picked, then a week's column (in place, the heads read it).
      await step("compare-week", async () => {
        await gamePage();
        const face = p.locator("[data-game-page] [data-door-cast]").first();
        if (!(await face.count())) return "SKIP: no castaway on Lineup League's page";
        await face.click();
        await castSheet();
        await wait(p, 700);
        await p.locator("[data-compare-with]").last().click();
        await p.locator("[data-compare-pick]").last().waitFor({ timeout: 15000 });
        await wait(p, 700);
        await p.locator("[data-compare-pick] button:not(:disabled)").nth(1).click();
        const weeks = p.locator("[data-compare] [data-compare-week]");
        await weeks.first().waitFor({ timeout: 15000 });
        if ((await weeks.count()) < 2) return "SKIP: one week to compare";
        const wk = weeks.first();
        const was = await dialogs(p).count();
        await shot("compare-week", "before");
        await wk.click();
        await wait(p, 700);
        await shot("compare-week", "after");
        if ((await dialogs(p).count()) !== was) return "a week's column opened a level";
        if ((await wk.getAttribute("aria-pressed")) !== "true") return "the column isn't marked as the week read";
        const heads = await p.locator("[data-compare]").last().innerText();
        return new RegExp(`Ep ${await wk.getAttribute("data-compare-week")} ·`).test(heads) ? null : "the heads don't read the week";
      });
      // The night itself over a sheet (step 3): a castaway's story names its episodes, each opening the episode's page as a level.
      await door("story-night", {
        go: async () => {
          await tonight();
          await p.locator("[data-last-out][data-door-cast]").first().click();
          await castSheet();
          await wait(p, 900);
        },
        door: async () => p.locator("[data-cast-sheet] [data-story-door]").first(),
        opened: async () => p.locator("[data-night-sheet] [data-episode-page]").last().waitFor({ timeout: 15000 }),
        under: 1,
        still: "[data-cast-sheet]",
        skip: "no castaway with a story on Tonight",
      });
      const lastOut = async () => {
        await tonight();
        await p.locator("[data-last-out][data-door-cast]").first().click();
        await castSheet();
        await wait(p, 900);
      };
      // The castaway's status names the night they left: it opens that night over their sheet.
      await door("status-night", {
        go: lastOut,
        door: async () => p.locator("[data-cast-sheet] [data-night-door]").first(),
        opened: async () => p.locator("[data-night-sheet] [data-episode-page]").last().waitFor({ timeout: 15000 }),
        under: 1,
        still: "[data-cast-sheet]",
        skip: "nobody who left on Tonight",
      });
      // A stat's strip (Their numbers, a row opened): an episode in it goes to that episode of their story, in place.
      await step("strip-story", async () => {
        // Someone on alex's team (Lineup League's page), who has numbers.
        await gamePage();
        await p.locator("[data-game-page] [data-door-cast]").first().click();
        await castSheet();
        await wait(p, 900);
        const row = p.locator("[data-cast-sheet] [data-stat-open]").first();
        if (!(await row.count())) return "SKIP: no numbers for them";
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await wait(p, 600);
        const marks = p.locator("[data-cast-sheet] [data-strip-episode]:not(:disabled)");
        if (!(await marks.count())) return "SKIP: no episode in the strip";
        const ep = marks.first();
        const n = await ep.getAttribute("data-strip-episode");
        const was = await dialogs(p).count();
        await ep.scrollIntoViewIfNeeded();
        await shot("strip-story", "before");
        await ep.click();
        await wait(p, 900);
        await shot("strip-story", "after");
        if ((await dialogs(p).count()) !== was) return "the strip opened a level";
        const box = await p.locator(`[data-cast-sheet] [data-story-ep="${n}"]`).last().boundingBox();
        return box && box.y > 0 && box.y + 24 < H ? null : `Episode ${n} of their story isn't in view`;
      });
      // Chat's landmark for an episode you've seen: the episode's page (a jump to the Episodes tab), back to the chat.
      await step("chat-episode", async () => {
        await p.goto(`${BASE}/show/${season}/chat`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-chat]").first().waitFor({ timeout: 45000 });
        await wait(p, 1500);
        const mark = p.locator("[data-ep-door]").last();
        if (!(await mark.count())) return "SKIP: no landmark for an episode alex has seen";
        const n = await mark.getAttribute("data-ep-door");
        const chatUrl = p.url();
        await mark.scrollIntoViewIfNeeded();
        await shot("chat-episode", "before");
        await mark.click();
        await p.locator(`[data-episode-page="${n}"]`).first().waitFor({ timeout: 20000 });
        await wait(p, 900);
        await shot("chat-episode", "after");
        await p.goBack();
        await p.locator("[data-chat]").first().waitFor({ timeout: 20000 });
        await wait(p, 900);
        await shot("chat-episode", "back");
        return p.url() === chatUrl ? null : `back landed on ${p.url()}, not the chat`;
      });
      // The hub (step 4a). The profile's numbers open the page each is compared on: the sheet closes in the same tap (a page can't
      // open over a sheet), and back lands on Home.
      const profileRow = (id, attr, page) =>
        step(id, async () => {
          await p.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
          await p.locator('button[aria-label="Your profile"]').first().waitFor({ timeout: 45000 });
          await wait(p, 1200);
          await p.locator('button[aria-label="Your profile"]').first().click();
          const row = p.locator(`[${attr}] :is(button, a)`).first();
          await row.waitFor({ timeout: 15000 }).catch(() => {});
          if (!(await row.count())) return `SKIP: no ${attr.replace("data-your-", "")} row for alex`;
          await wait(p, 700);
          await shot(id, "before");
          await row.click();
          const target = page.startsWith("[") ? page : `[data-couch-page="${page}"]`;
          await p.locator(target).first().waitFor({ timeout: 20000 });
          await wait(p, 900);
          await shot(id, "after");
          // (A pushed page is a dialog too: the profile sheet's own content is what mustn't be up.)
          if (await p.locator("[data-your-numbers]").first().isVisible().catch(() => false)) return "the profile sheet is still up over the page";
          await p.goBack();
          await wait(p, 1200);
          await shot(id, "back");
          const home = new URL(p.url());
          const stillUp = await p.locator(`${target}, [data-your-numbers]`).first().isVisible().catch(() => false);
          return home.pathname === "/home" && !home.searchParams.get("page") && !stillUp ? null : `back landed on ${p.url()}${stillUp ? " with something still up" : ""}`;
        });
      await profileRow("profile-place", "data-your-place", "rankings");
      await profileRow("profile-called", "data-your-called", "numbers");
      await profileRow("profile-finish", "data-your-finish", "[data-game-page]");
      // Previously on: the show's own drill over the page. A face opens their sheet, an episode the night.
      const previously = async () => {
        await p.goto(`${BASE}/home?page=previously`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-previously]").first().waitFor({ timeout: 45000 });
        await wait(p, 1500);
      };
      const castOrNight = async () => p.locator("[data-cast-sheet], [data-night-sheet]").last().waitFor({ timeout: 20000 });
      await door("po-last", { go: previously, door: async () => p.locator("[data-po-last]").first(), opened: castOrNight, still: "[data-previously]", skip: "no Last time" });
      await door("po-gone", { go: previously, door: async () => p.locator("[data-po-gone] [data-door-cast]").first(), opened: castSheet, still: "[data-previously]", skip: "nobody gone yet" });
      await door("po-still", { go: previously, door: async () => p.locator("[data-po-still] [data-door-cast]").first(), opened: castSheet, still: "[data-previously]", skip: "nobody still in" });
      await door("po-episode", {
        go: previously,
        door: async () => p.locator("[data-po-ep]").first(),
        opened: async () => p.locator("[data-night-sheet] [data-episode-page]").last().waitFor({ timeout: 20000 }),
        still: "[data-previously]",
        skip: "no episode seen",
      });
      await door("best-lineup", {
        go: async () => {},
        door: async () => p.locator("[data-best-door]").first(),
        opened: async () => p.locator("[data-compare]").last().waitFor({ timeout: 15000 }),
        skip: "the test couch has no head-to-head game (a matchup's best lineup)",
      });
    }

    // The draft room (step 2b): every castaway on it opens the one castaway sheet, the room's action (or who has them) at its foot.
    if (SETS.includes("draft") && ["draft-taken", "draft-slot", "draft-board-cell", "draft-queue-row", "draft-blind-slot", "draft-done-cell"].some(wanted)) {
      const dfx = require("./draft-fixture");
      const draftSheet = async () => p.locator("[data-draft-sheet-body]").last().waitFor({ timeout: 20000 });
      const footSays = (text) => async () => {
        const t = ((await p.locator("[data-draft-sheet-foot]").last().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
        return t.includes(text) ? null : `the foot says "${t}", not "${text}"`;
      };
      try {
        const fx = await dfx.up(pool, { live: 6 });
        // The blind draft's room is live once it's started (alex is its Commissioner).
        const alexApi = await api({ user: dfx.username("alex"), pass: dfx.PASSWORD });
        await alexApi.call("POST", `/api/seasons/${fx.seasonId}/draft`, { leagueId: fx.leagues.lineup, action: "start" });
        await as(dfx.username("alex"), dfx.PASSWORD);
        const room = (view) => async () => {
          await p.goto(`${BASE}/show/${fx.seasonId}/draft?game=${fx.leagues.outlast}`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-draft]").first().waitFor({ timeout: 45000 });
          await wait(p, 1200);
          if (view) {
            await p.locator(`[data-seg="${view}"]`).first().click();
            await wait(p, 700);
          }
        };
        await door("draft-taken", {
          go: async () => {
            await room()();
            await p.locator("[data-show-taken]").first().click();
            await wait(p, 700);
          },
          door: async () => p.locator('[data-draft-wall] [data-tile][aria-label*="taken by"]:not([aria-label$="taken by alex"])').first(),
          opened: draftSheet,
          check: footSays("Taken by"),
          still: "[data-draft-wall]",
        });
        await door("draft-slot", { go: room(), door: async () => p.locator("[data-slot-filled][data-door-cast]").first(), opened: draftSheet, check: footSays("On your team"), still: "[data-draft]", skip: "alex has no pick yet" });
        await door("draft-board-cell", { go: room("picks"), door: async () => p.locator("[data-pick-cell] [data-door-cast]").first(), opened: draftSheet, still: "[data-pick-cell]" });
        await door("draft-queue-row", {
          go: room("queue"),
          door: async () => p.locator("[data-queue-row] [data-door-cast]").first(),
          opened: draftSheet,
          check: async () => ((await p.locator("[data-sheet-draft]").count()) ? null : "no Draft at the foot while alex is up"),
          still: "[data-queue-row]",
          skip: "alex's queue is empty",
        });
        await door("draft-blind-slot", {
          go: async () => {
            await p.goto(`${BASE}/show/${fx.seasonId}/blind?game=${fx.leagues.lineup}`, { waitUntil: "domcontentloaded" });
            await p.locator("[data-draft]").first().waitFor({ timeout: 45000 });
            await wait(p, 1200);
            // Someone onto your team from their sheet (the wall's way), so a slot holds them.
            await p.locator("[data-draft-wall] [data-tile]").first().click();
            await draftSheet();
            await wait(p, 600);
            await p.locator('[data-draft-sheet-foot] button:has-text("Add to your team")').last().click();
            await wait(p, 1100);
          },
          door: async () => p.locator("[data-my-team] [data-slot][data-door-cast]").first(),
          opened: draftSheet,
          check: footSays("Take them out"),
          still: "[data-my-team]",
          skip: "nobody on your team in the blind draft",
        });
        if (wanted("draft-done-cell")) {
          // Every pick in: the draft done, its board the teams.
          await dfx.down(pool);
          const done = await dfx.up(pool, { live: 99 });
          await as(dfx.username("alex"), dfx.PASSWORD);
          await door("draft-done-cell", {
            go: async () => {
              await p.goto(`${BASE}/show/${done.seasonId}/draft?game=${done.leagues.outlast}`, { waitUntil: "domcontentloaded" });
              await p.locator("[data-draft]").first().waitFor({ timeout: 45000 });
              await wait(p, 1500);
            },
            door: async () => p.locator("[data-draft-done] [data-pick-cell] [data-door-cast]").first(),
            opened: draftSheet,
            check: footSays("team"),
            still: "[data-draft-done]",
            skip: "the draft didn't read as done",
          });
        }
      } finally {
        if (!KEEP) await dfx.down(pool);
      }
    }

    // Waivers (step 2b): the spot plate's faces, the picker's photos (its pick at the sheet's foot), and who moved and whom they got.
    const WAIVERS = { open: ["waiver-spot", "waiver-picker-face", "waiver-picker-pick"], processed: ["waiver-move-face", "waiver-move-person"], idle: ["waiver-last-face"] };
    if (SETS.includes("waivers") && Object.values(WAIVERS).flat().some(wanted)) {
      const wfx = require("./waivers-fixture");
      const wvSheet = async () => p.locator("[data-wv-sheet]").last().waitFor({ timeout: 20000 });
      try {
        for (const [phase, ids] of Object.entries(WAIVERS)) {
          if (!ids.some(wanted)) continue;
          await wfx.up(pool, [`--phase=${phase}`, "--ui=new"]);
          const season = (await one(`SELECT id FROM show_seasons WHERE name = 'zt-waivers' ORDER BY season_number DESC LIMIT 1`)).id;
          await as("zt_wplayer");
          const page = async () => {
            await p.goto(`${BASE}/show/${season}/waivers`, { waitUntil: "domcontentloaded" });
            await p.locator("[data-wv-week], [data-wv-plate]").first().waitFor({ timeout: 45000 });
            await wait(p, 1500);
          };
          const picker = async () => {
            await page();
            await p.locator("[data-wv-spot] [data-swap]").first().click();
            await p.locator("[data-wv-picker]").waitFor({ timeout: 15000 });
            await wait(p, 900);
          };
          if (phase === "open") {
            await door("waiver-spot", { go: page, door: async () => p.locator("[data-wv-spot] [data-door-cast]").first(), opened: wvSheet, still: "[data-wv-spot]", skip: "no spot to fill" });
            await door("waiver-picker-face", {
              go: picker,
              door: async () => p.locator("[data-wv-picker] [data-door-cast]").first(),
              opened: wvSheet,
              check: async () => {
                const t = ((await p.locator("[data-wv-sheet-pick]").last().innerText().catch(() => "")) || "").trim();
                return /^Pick /.test(t) ? null : `the foot says "${t}", not Pick …`;
              },
              under: 1,
              still: "[data-wv-picker]",
            });
            await step("waiver-picker-pick", async () => {
              await picker();
              // What's up with the picker alone (the waivers page's own layers count too), to come back to after Pick.
              const base = await dialogs(p).count();
              const face = p.locator("[data-wv-picker] [data-door-cast]").nth(1);
              if (!(await face.count())) return "SKIP: fewer than two free";
              const name = await face.getAttribute("data-door-cast");
              await face.click();
              await wvSheet();
              await wait(p, 700);
              await p.locator("[data-wv-sheet-pick]").last().click();
              await wait(p, 1000);
              await shot("waiver-picker-pick", "after");
              const sheets = await dialogs(p).count();
              const pressed = await p.locator("[data-wv-picker] [data-fa]").filter({ has: p.locator(`text=${name}`) }).first().getAttribute("aria-pressed");
              if (sheets !== base) {
                const what = await p.$$eval('[role="dialog"]', (ds) => ds.map((d) => `${d.querySelector("h2")?.textContent ?? "?"} (${d.getAttribute("data-state") ?? "-"}, ${d.getBoundingClientRect().height | 0}px)`));
                return `${sheets} sheets up after Pick (want ${base}, the picker's): ${what.join("; ")}`;
              }
              return pressed === "true" ? null : `${name}'s row isn't chosen`;
            });
          }
          if (phase === "processed") {
            await door("waiver-move-face", { go: page, door: async () => p.locator("[data-wv-move] [data-door-cast]").first(), opened: castSheet, still: "[data-wv-week]", skip: "nobody moved" });
            await door("waiver-move-person", {
              go: page,
              door: async () => p.locator("[data-wv-move] [data-door-person]").first(),
              opened: async () => p.locator("[data-person-sheet]").last().waitFor({ timeout: 20000 }),
              still: "[data-wv-week]",
              skip: "nobody moved",
            });
          }
          if (phase === "idle") {
            await door("waiver-last-face", { go: page, door: async () => p.locator("[data-wv-last] [data-door-cast]").first(), opened: castSheet, still: "[data-wv-last]", skip: "no Last time on a quiet week" });
          }
        }
      } finally {
        if (!KEEP) await wfx.down(pool);
      }
    }

    // Sports (step 4b), on a stand-in ESPN (fake-espn.js, by the x-gys-sports header: the real one is never asked), as alex:
    //  - a sport from TV listings that isn't a game yet ("ZT Drill Ball", seeded as Add a show leaves one: no set_up_at, its three
    //    games linked to the stand-in's), whose Players tab's own read fills its people from the stand-in's rosters;
    //  - the ZT Hawks' season added through Add a show's route (a league season is a game already: a sport's Cast tab), its people
    //    and box score from the stand-in, then a Pick'em on it.
    const SPORTS = ["roster-person", "roster-team", "athlete-log", "cast-team"];
    if (SETS.includes("sports") && SPORTS.some(wanted)) {
      const LG = "football/zt-ddf";
      const crew = (base, positions) => positions.map((x, i) => ({ id: `${base}${i}`, name: `ZT ${x} ${base}${i}`, position: x }));
      const TEAMS = [
        { id: "9601", name: "ZT Hawks", short: "Hawks", location: "ZT Hawkton", abbreviation: "ZHWK", league: LG, color: "a71930", roster: crew("96010", ["QB", "WR", "RB"]) },
        { id: "9602", name: "ZT Owls", short: "Owls", location: "ZT Owlburg", abbreviation: "ZOWL", league: LG, color: "203731", roster: crew("96020", ["QB", "WR", "RB"]) },
      ];
      const DAY = 24 * 3600_000;
      const when = (ms) => new Date(Math.round((Date.now() + ms) / 60_000) * 60_000).toISOString();
      const lines = (t, stats) => ({ labels: ["YDS", "TD"], rows: t.roster.map((r, i) => ({ id: r.id, name: r.name, position: r.position, stats: stats[i] })) });
      const EVENTS = [
        { league: LG, id: "96101", at: when(-7 * DAY), home: "9601", away: "9602", state: "post", score: [21, 14], box: { 9601: lines(TEAMS[0], [["212", "2"], ["88", "1"], ["54", "0"]]), 9602: lines(TEAMS[1], [["180", "1"], ["61", "1"], ["40", "0"]]) } },
        { league: LG, id: "96102", at: when(3 * DAY), home: "9602", away: "9601", state: "pre" },
        { league: LG, id: "96103", at: when(10 * DAY), home: "9601", away: "9602", state: "pre" },
      ];
      // Every row of its league: its show (its seasons, cast, follows and lines go with it), the games on it, its events and links.
      const sportsDown = async () => {
        const { rows: shows } = await pool.query("SELECT id, slug FROM shows WHERE sports_league LIKE $1", [`%:${LG}`]);
        if (shows.length) {
          await pool.query("DELETE FROM leagues WHERE state->'settings'->>'showId' = ANY($1::text[])", [shows.map((x) => x.slug)]);
          await pool.query("DELETE FROM season_events WHERE league = $1", [LG]);
          await pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows.map((x) => x.id)]);
        }
        for (const t of ["sports_events", "team_follows", "sports_recordings", "sports_matchups", "sports_slates", "sports_links", "season_events"]) await pool.query(`DELETE FROM ${t} WHERE league = $1`, [LG]).catch(() => {});
        await pool.query("DELETE FROM shows WHERE slug = 'zt-ddf-tv'");
        await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
      };
      const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
      const { pool: appPool } = jiti("../../src/lib/server/db.ts");
      const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
      const espn = await require("./fake-espn").start({ teams: TEAMS, leagues: [{ league: LG, name: "ZT Drill Football League", short: "ZTDF" }], events: EVENTS });
      const headers = { "x-gys-sports": espn.url };
      try {
        await sportsDown();
        await leagueShow(appPool, "espn", LG, "", null, { name: "ZT Drill Football League", short: "ZTDF" });
        // The TV sport, not a game yet: a show with no set_up_at (show-space.ts `ready`), its season's games linked, alex following it.
        const alexId = (await one(`SELECT id FROM "user" WHERE username = 'zt_nd_alex'`))?.id;
        const tvShow = (await one(`INSERT INTO shows (slug, name, kind, set_up_at) VALUES ('zt-ddf-tv', 'ZT Drill Ball', 'sport', NULL) RETURNING id`)).id;
        const tvSeason = (await one(`INSERT INTO show_seasons (show_id, season_number, episode_count) VALUES ($1, 1, 3) RETURNING id`, [tvShow])).id;
        const sides = JSON.stringify([{ id: "9601", name: "ZT Hawks" }, { id: "9602", name: "ZT Owls" }]);
        for (const [i, e] of EVENTS.entries()) await pool.query(`INSERT INTO season_episodes (season_id, number, air_at, title) VALUES ($1, $2, $3, $4)`, [tvSeason, i + 1, e.at, `Game ${i + 1}`]);
        for (const [i, e] of EVENTS.entries())
          await pool.query(`INSERT INTO season_events (season_id, episode, provider, league, event_id, name, starts_at, teams) VALUES ($1, $2, 'espn', $3, $4, $5, $6, $7)`, [tvSeason, i + 1, LG, e.id, `Game ${i + 1}: ZT Owls at ZT Hawks`, e.at, sides]);
        await pool.query(`INSERT INTO sports_links (season_id, provider, league, linked, checked_at, next_at) VALUES ($1, 'espn', $2, 3, now(), now() + interval '30 days')`, [tvSeason, LG]);
        await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 1)`, [alexId, tvSeason]);
        const me = await api({ user: "zt_nd_alex", pass: "zt-pass-12345", headers });
        const added = await me.call("POST", "/api/sports/add", { league: LG, team: "9601", whole: "season" });
        const seasonId = added.body?.seasonId;
        if (!seasonId) throw new Error(`the Hawks' season wasn't added: ${added.status} ${JSON.stringify(added.body).slice(0, 200)}`);
        // Its people from the stand-in's rosters, then their lines from the box score, as the tab's reads fill them.
        const until = async (ask, ok, ms = 90000) => {
          const end = Date.now() + ms;
          for (;;) {
            const r = await ask();
            if (ok(r) || Date.now() > end) return r;
            await new Promise((res) => setTimeout(res, 2500));
          }
        };
        const filled = (r) => (r.body?.groups ?? []).some((g) => g.people.length) && !r.body?.asking && !r.body?.stats?.asking;
        await until(() => me.call("GET", `/api/seasons/${tvSeason}/roster`), filled);
        const roster = await until(() => me.call("GET", `/api/seasons/${seasonId}/roster`), filled);
        const qb = (roster.body?.groups ?? []).find((g) => g.name === "ZT Hawks")?.people.find((x) => x.role === "QB")?.name ?? null;
        if (qb) await until(() => me.call("GET", `/api/seasons/${seasonId}/player-log?name=${encodeURIComponent(qb)}`), (r) => (r.body?.games ?? []).length > 0, 60000);
        await as("zt_nd_alex", "zt-pass-12345", headers);
        const players = async () => {
          await p.goto(`${BASE}/show/${tvSeason}/cast`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-roster-person], [data-roster]").first().waitFor({ timeout: 45000 });
          await wait(p, 1500);
        };
        const sportCast = async (id) => {
          await p.goto(`${BASE}/show/${id}/cast`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-sport-list]").first().waitFor({ timeout: 45000 });
          await wait(p, 1500);
        };
        const athlete = async () => p.locator("[data-athlete-sheet]").last().waitFor({ timeout: 20000 });
        await door("roster-person", { go: players, door: async () => p.locator("[data-roster-person]").first(), opened: athlete, still: "[data-roster]", skip: "nobody on the Players tab" });
        await door("roster-team", {
          go: players,
          door: async () => p.locator("[data-roster] [data-team-door]").first(),
          opened: async () => p.locator("[data-team-page]").last().waitFor({ timeout: 20000 }),
          still: "[data-roster]",
          skip: "no team with its id on the Players tab",
        });
        await door("athlete-log", {
          go: async () => {
            await sportCast(seasonId);
            await p.locator(qb ? `[data-sport-list] [data-athlete="${qb}"]` : "[data-sport-list] [data-athlete]").first().click();
            await athlete();
            await p.locator("[data-athlete-sheet] [data-log-game]").first().waitFor({ timeout: 20000 }).catch(() => {});
            await wait(p, 700);
          },
          door: async () => p.locator("[data-athlete-sheet] [data-game-door]").first(),
          opened: async () => p.locator("[data-game-view]").last().waitFor({ timeout: 20000 }),
          under: 1,
          still: "[data-athlete-sheet]",
          skip: "no game in the athlete's log",
        });
        // A game on it: the season is a game now, and its Cast tab lists everyone by team.
        if (wanted("cast-team")) {
          const couch = (await one(`SELECT cm.couch_id FROM couch_members cm JOIN "user" u ON u.id = cm.user_id WHERE u.username = 'zt_nd_alex' LIMIT 1`))?.couch_id;
          const started = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: LG, team: "9601", whole: "season", game: "pickem", tell: false });
          const gameSeason = started.body?.seasonId ?? seasonId;
          await door("cast-team", {
            go: () => sportCast(gameSeason),
            door: async () => p.locator("[data-sport-list] [data-team-door]").first(),
            opened: async () => p.locator("[data-team-page]").last().waitFor({ timeout: 20000 }),
            still: "[data-sport-list]",
            skip: `no team door on the Cast tab (the game's start: ${started.status})`,
          });
        }
      } finally {
        await espn.close();
        if (!KEEP) await sportsDown();
        await appPool.end?.().catch(() => {});
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
    if (b) await b.close();
    await pool.end();
  }
  const failed = results.filter((r) => r[1] === "FAIL").length;
  console.log(`${results.length} doors: ${results.filter((r) => r[1] === "PASS").length} pass, ${failed} fail, ${results.filter((r) => r[1] === "SKIP").length} skipped`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
