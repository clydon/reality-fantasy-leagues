// Dev-only check for the TV guide (docs/PLAN-new-design.md step 11 part 1), against the dev server, on new-fixture.js's couch
// ("ZT Survivor 51": alex, riley, jordan and sam; riley follows ZT Traitors 5 openly, jordan privately) plus guide-fixture.js
// (ZT Late Show nightly, which alex and riley watch; ZT Live Now on the air, which alex watches privately; ZT Drop Show, all
// eight episodes at once in two days, which riley and jordan watch; ZT Same Night, alex's, starting with the Traitors).
//   API:
//   - the home read's week per show (when each episode airs and how long, never a title), for your shows and the couch's;
//     a drop's episodes at one moment; a private follow nobody else sees (alex's Live Now; jordan's Traitors);
//   - Hide from guide: a couch show (by its season), refused for your own shows (watched or played), bad requests, a TV
//     listing nobody has made a show of, a listing that's a show here hidden as that show, Show again by show and by
//     listing, nobody else seeing it.
//   In a real browser at --width (390 by default), as alex: seven days from today, the Now line, On now, Same time (yours
//   first), the drop's one card, the due dot on Survivor, dashed and faded, no Preview left (Also on is part 2's, real:
//   check-new-listings.js); the hub doesn't
//   read the catalog until Add a show opens (from Noticed); a couch show's sheet (who watches it), Hide from guide with
//   the toast's Undo, "1 hidden" and Show again, Add to my shows (where you are, then it's yours: dashed, no longer faded), a
//   card of yours opening its show. As casey (alex's other couch): hiding the Late Show leaves today with Nothing tonight /
//   Next up. Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-guide.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and guide-fixture.js up and takes them down (--keep leaves them); touches
// zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const guideFixture = require("./guide-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-guide runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-guide.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const gd = await guideFixture.up(pool, fx);
    const { late, live, drop, same } = gd.seasons;
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/love-island.jpg' WHERE slug = 'zt-gd-same-night'`);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });
    const home = async (who) => (await as[who].call("GET", "/api/me/home")).body;
    const hide = (who, body) => as[who].call("POST", "/api/me/guide/hidden", body);
    const rows = async (who) => (await pool.query("SELECT show_id, tvmaze_id, name FROM guide_hidden WHERE user_id = $1 ORDER BY name", [fx.users[who]])).rows;
    const showIdOf = async (seasonId) => (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [seasonId])).rows[0].show_id;

    // ---------- the week ----------
    const h = await home("alex");
    const mine = (id) => h.shows.find((s) => s.seasonId === id);
    const theirs = (id) => h.couchShows.find((s) => s.seasonId === id);
    const weeks = [...h.shows, ...h.couchShows].flatMap((s) => s.week ?? []);
    check(weeks.length > 0 && weeks.every((e) => Object.keys(e).sort().join() === "airAt,number,runtimeMin"), "every week entry: when it airs and how long, never a title", JSON.stringify(weeks[0]));
    const liveEp = mine(live)?.week.find((e) => e.number === 3);
    check(!!liveEp && Date.now() - Date.parse(liveEp.airAt) < 15 * 60_000 && liveEp.runtimeMin === 60, "ZT Live Now's Episode 3 started minutes ago (alex watches it)", JSON.stringify(mine(live)?.week));
    const lateWeek = mine(late)?.week ?? [];
    check(lateWeek.length >= 8 && lateWeek.length <= 11, "the nightly Late Show: one a day, a day and a bit back to eight on", String(lateWeek.length));
    const dropWeek = theirs(drop)?.week ?? [];
    check(theirs(drop)?.release === "binge" && dropWeek.length === 8 && dropWeek.every((e) => e.airAt === gd.dropAt), "ZT Drop Show (riley and jordan watch it): all eight at one moment, on alex's couch shows", JSON.stringify(dropWeek.slice(0, 2)));
    check(mine(same)?.week.some((e) => e.number === 4 && e.airAt === gd.traitorsAt) && theirs(tsid)?.week.some((e) => e.airAt === gd.traitorsAt), "ZT Same Night (alex's) and the Traitors (the couch's) start at the same moment");
    check(mine(sid)?.week.some((e) => e.number === 6), "ZT Survivor 51's Episode 6 is this week");
    check(Array.isArray(h.guideHidden) && h.guideHidden.length === 0, "nothing hidden yet");
    const couch = h.couches.find((c) => c.id === fx.couchId);
    check(!couch.members.find((m) => m.name === fixture.username("jordan")).watching.includes(tsid), "jordan watches the Traitors privately: not in what alex sees");
    const rh = await home("riley");
    check(![...rh.shows, ...rh.couchShows].some((s) => s.seasonId === live), "alex watches ZT Live Now privately: nowhere in riley's home");
    check(rh.couches.every((c) => c.members.every((m) => !m.watching.includes(live))), "nor in anyone's watching list");

    // ---------- Hide from guide ----------
    let r = await hide("alex", { seasonId: drop, hidden: true });
    const dropShow = await showIdOf(drop);
    check(r.status === 200 && r.body.hidden.length === 1 && r.body.hidden[0].showId === dropShow && r.body.hidden[0].name === "ZT Drop Show", "alex hides ZT Drop Show (a couch show)", JSON.stringify(r.body));
    check((await home("alex")).guideHidden.length === 1 && (await home("riley")).guideHidden.length === 0, "it's in alex's home read, nobody else's");
    r = await hide("alex", { seasonId: late, hidden: true });
    check(r.status === 409 && /own shows/.test(r.body.error), "his own show (the Late Show, watched) can't be hidden", JSON.stringify(r.body));
    r = await hide("alex", { seasonId: sid, hidden: true });
    check(r.status === 409, "nor one he plays (Survivor)", JSON.stringify(r.body));
    check((await hide("alex", { hidden: true })).status === 400, "which show? 400");
    check((await hide("alex", { seasonId: drop, hidden: "yes" })).status === 400, "hidden must be true or false: 400");
    check((await hide("alex", { seasonId: "nope", hidden: true })).status === 404 && (await hide("alex", { seasonId: crypto.randomUUID(), hidden: true })).status === 404, "a season that isn't here: 404");
    r = await hide("alex", { tvmazeId: 990777, name: "ZT Listing Only", hidden: true });
    check(r.status === 200 && r.body.hidden.some((x) => x.tvmazeId === 990777 && x.showId === null && x.name === "ZT Listing Only"), "a TV listing nobody has made a show of: hidden by its listing", JSON.stringify(r.body));
    check((await hide("alex", { tvmazeId: 990779, hidden: true })).status === 400, "a listing needs its name");
    await pool.query("UPDATE shows SET tvmaze_id = 990778 WHERE id = $1", [dropShow]);
    r = await hide("alex", { tvmazeId: 990778, name: "whatever", hidden: true });
    check(r.status === 200 && r.body.hidden.filter((x) => x.showId === dropShow).length === 1, "a listing that's a show here is that show (no second row)", JSON.stringify(r.body));
    await pool.query("UPDATE shows SET tvmaze_id = NULL WHERE id = $1", [dropShow]);
    r = await hide("alex", { showId: dropShow, hidden: false });
    check(r.status === 200 && !r.body.hidden.some((x) => x.showId === dropShow), "Show again, by the show", JSON.stringify(r.body));
    r = await hide("alex", { tvmazeId: 990777, hidden: false });
    check(r.status === 200 && r.body.hidden.length === 0 && (await rows("alex")).length === 0, "and the listing: nothing hidden");

    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      let n = 0;
      const browse = async (who) => {
        // Motion off, so a capture sees where a push lands; reduced motion too, so the guide holds still (it rolls otherwise).
        const b = await open({ user: fixture.username(who), pass: PASSWORD, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const asked = [];
        b.page.on("request", (q) => asked.push(new URL(q.url()).pathname));
        const pg = b.page;
        const shot = async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`) });
        };
        const wide = async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
        };
        const reel = (x) => pg.evaluate((left) => (document.querySelector("[data-guide] .overflow-x-auto").scrollLeft = left), x);
        const toGuide = async () => {
          await pg.locator("[data-guide]").scrollIntoViewIfNeeded();
          await pg.evaluate(() => window.scrollBy(0, -70));
        };
        const errorsOf = () => b.errors.filter((e) => !/Failed to load resource/.test(e)).concat(b.errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
        const status = () => pg.locator("[role=status]").last();
        // A show's cards, or (with its first episode's number) one card.
        const card = (seasonId, n) => pg.locator(n == null ? `[data-guide-card^="${seasonId}:"]` : `[data-guide-card="${seasonId}:${n}"]`);
        return { pg, shot, wide, reel, toGuide, errorsOf, status, card, asked };
      };

      // ---------- alex ----------
      const A = await browse("alex");
      const { pg } = A;
      await pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await pg.locator("[data-guide] [data-guide-day='0']").waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      check((await pg.locator("[data-guide-day]").count()) === 7, "seven days");
      const label = (await pg.locator("[data-guide-day='0'] b").first().textContent()).trim();
      const hour = new Date().getHours();
      check(label === (hour >= 17 || hour < 3 ? "Tonight" : "Today"), "today's label (Tonight from 5 PM until the guide's day ends at 3 AM)", label);
      check(/^Tomorrow$/.test((await pg.locator("[data-guide-day='1'] b").first().textContent()).trim()), "then Tomorrow");
      check((await pg.locator("[data-guide-day='0'] [data-guide-now]").count()) === 1 && (await pg.locator("[data-guide-now]").count()) === 1, "the Now line, on today only");
      const liveCard = A.card(live, 3);
      check((await liveCard.getAttribute("data-live")) === "true" && /On now/.test(await liveCard.textContent()) && (await liveCard.getAttribute("data-tie")) === "watches", "ZT Live Now: On now, dashed (watched, not played)");
      // The Now line comes before what's on now.
      const order = await pg.locator("[data-guide-day='0']").evaluate((day) => [...day.querySelectorAll("[data-guide-now], [data-guide-card]")].map((x) => (x.hasAttribute("data-guide-now") ? "now" : x.getAttribute("data-guide-card").split(":")[0])));
      check(order.indexOf("now") === order.indexOf(live) - 1 && order.indexOf(live) > -1, "the Now line sits just above what's on now", order.join(","));
      const sameGroup = pg.locator("[data-guide-same]", { has: A.card(same, 4) });
      const inGroup = await sameGroup.locator("[data-guide-card]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-guide-card").split(":")[0]));
      check(inGroup.join() === [same, tsid].join() && /Same time/i.test(await sameGroup.textContent()), "Same time: ZT Same Night (yours) above the couch's Traitors", inGroup.join());
      check((await A.card(tsid, 4).getAttribute("data-tie")) === "couch", "the Traitors: the couch's (faded)");
      const dropCard = A.card(drop, 1);
      check((await dropCard.count()) === 1 && (await dropCard.getAttribute("data-drop")) === "8" && /All 8 drop/i.test(await dropCard.textContent()), "ZT Drop Show: one card, All 8 drop");
      check((await A.card(sid, 6).locator("[data-due]").count()) === 1 && (await A.card(sid, 6).getAttribute("data-tie")) === "plays", "ZT Survivor 51: yours in full, with the due dot");
      check((await A.card(late).count()) >= 6, "the Late Show every night", String(await A.card(late).count()));
      const legend = await pg.locator("[data-guide-foot]").textContent();
      check(/Dashed: not playing yet/.test(legend) && /Faded: not on your shows/.test(legend), "the foot says what dashed and faded mean", legend);
      check((await pg.locator("[data-guide-hidden]").count()) === 0, "nothing hidden: no hidden count");
      // Reduced motion (this browser's): it never rolls, so it says neither Rolling nor Paused (from Noticed); with motion it does.
      check((await pg.locator("[data-guide-roll]").count()) === 0, "reduced motion: no Rolling or Paused");
      await pg.emulateMedia({ reducedMotion: "no-preference" });
      await pg.locator("[data-guide-roll]").waitFor({ timeout: 10_000 }).catch(() => {});
      check((await pg.locator("[data-guide-roll]").count()) === 1, "with motion, the guide's status is back");
      await pg.emulateMedia({ reducedMotion: "reduce" });
      check(!A.asked.includes("/api/catalog"), "the hub didn't read the catalog (from Noticed)", A.asked.filter((p) => p.startsWith("/api/")).join(","));
      await A.toGuide();
      await A.shot("guide-today");
      await A.wide("the hub with the guide");
      await A.reel(330);
      await A.shot("guide-midweek");
      await A.reel(0);

      // Also on is real since part 2 (check-new-listings.js): nothing in the guide is Preview now.
      check((await pg.locator("[data-guide] [data-preview]").count()) === 0, "nothing in the guide is Preview");

      // Add a show reads the catalog once it opens.
      await pg.locator("[data-guide-add]").click();
      await pg.locator("[role=dialog][data-open]").waitFor();
      await pg.waitForTimeout(1200);
      check(A.asked.includes("/api/catalog"), "Add a show reads the catalog when it opens");
      await pg.keyboard.press("Escape");
      await pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {});

      // A couch show's sheet: who watches it, Hide from guide, the toast's Undo.
      await A.reel(330);
      await dropCard.click();
      const sheet = pg.locator(`[data-guide-sheet="${drop}"]`);
      await sheet.waitFor();
      const said = await sheet.textContent();
      check(/zt_nd_riley and zt_nd_jordan watch it/.test(said) || /zt_nd_jordan and zt_nd_riley watch it/.test(said), "its sheet: who on the couch watches it", said.slice(0, 160));
      check(/All 8 drop/.test(await pg.locator("[role=dialog][data-open]").textContent()), "and when it drops");
      await pg.waitForTimeout(400);
      await A.shot("couch-show-sheet");
      await sheet.locator("[data-guide-hide]").click();
      await pg.locator("[data-guide-hidden]").waitFor();
      check(/ZT Drop Show is hidden from your guide/.test(await A.status().textContent()), "the toast says so");
      check((await A.card(drop, 1).count()) === 0 && /1 hidden/.test(await pg.locator("[data-guide-hidden]").textContent()), "it's off the guide: 1 hidden");
      check((await rows("alex")).length === 1, "saved");
      await A.status().getByRole("button", { name: "Undo" }).click();
      await A.card(drop, 1).waitFor();
      check((await rows("alex")).length === 0 && (await pg.locator("[data-guide-hidden]").count()) === 0, "Undo brings it back");
      // Hidden again, then Show again from "1 hidden".
      await A.card(drop, 1).click();
      await sheet.waitFor();
      await sheet.locator("[data-guide-hide]").click();
      await pg.locator("[data-guide-hidden]").waitFor();
      await pg.waitForTimeout(500);
      await A.toGuide();
      await A.shot("one-hidden");
      await pg.locator("[data-guide-hidden]").click();
      const list = pg.locator("[data-guide-hidden-list]");
      await list.waitFor();
      check((await list.locator("[data-hidden-row]").count()) === 1 && /ZT Drop Show/.test(await list.textContent()), "the hidden sheet lists it");
      await pg.waitForTimeout(400);
      await A.shot("hidden-sheet");
      await list.getByRole("button", { name: "Show again" }).click();
      await A.card(drop, 1).waitFor();
      check((await rows("alex")).length === 0 && (await pg.locator("[data-guide-hidden]").count()) === 0, "Show again: back on the guide, nothing hidden");
      await pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {});

      // Add to my shows from a couch show's sheet: where you are, then it's yours (dashed, not faded).
      await A.reel(0);
      await A.card(tsid, 4).click();
      await pg.locator(`[data-guide-sheet="${tsid}"]`).waitFor();
      await pg.locator(`[data-guide-sheet="${tsid}"] [data-guide-follow]`).click();
      const where = pg.locator("[role=dialog][data-open]", { hasText: "Where are you in" });
      await where.waitFor();
      await pg.waitForTimeout(400);
      await A.shot("add-from-guide");
      await where.getByRole("button", { name: "Add to my shows" }).click();
      await pg.waitForFunction((id) => document.querySelector(`[data-guide-card^="${id}:"]`)?.getAttribute("data-tie") === "watches", tsid, { timeout: 15_000 }).catch(() => {});
      check((await A.card(tsid, 4).getAttribute("data-tie")) === "watches", "added: the Traitors are alex's now (dashed, no longer faded)");
      check((await pool.query("SELECT following FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.alex, tsid])).rows[0]?.following === true, "saved as a follow");

      // A card of yours opens its show.
      await pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {});
      await A.card(late).first().click();
      await pg.waitForURL(`**/show/${late}/tonight`, { timeout: 15_000 });
      check(new URL(pg.url()).pathname === `/show/${late}/tonight`, "a card of yours opens its show");
      check(A.errorsOf().length === 0, "no page errors (alex)", A.errorsOf().join(" | "));

      // ---------- casey: Nothing tonight · Next up ----------
      const C = await browse("casey");
      await C.pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await C.pg.locator("[data-guide] [data-guide-day='0']").waitFor({ timeout: 30_000 });
      await C.pg.waitForTimeout(800);
      check((await C.card(live).count()) === 0, "casey (alex's other couch) doesn't see alex's private show");
      check((await C.card(late).count()) >= 6 && (await C.card(late).first().getAttribute("data-tie")) === "couch", "the Late Show is a couch show for casey (alex watches it)");
      await C.pg.locator("[data-guide-day='0']").locator(`[data-guide-card^="${late}:"]`).first().click();
      await C.pg.locator(`[data-guide-sheet="${late}"] [data-guide-hide]`).click();
      await C.pg.locator("[data-guide-day='0'] [data-guide-next]").waitFor({ timeout: 10_000 });
      const next = await C.pg.locator("[data-guide-day='0'] [data-guide-next]").textContent();
      check(/Nothing (tonight|today)/i.test(next) && /Next up/i.test(next), "today's empty for casey now: Nothing tonight · Next up", next);
      check((await C.card(late).count()) === 0 && /1 hidden/.test(await C.pg.locator("[data-guide-hidden]").textContent()), "the Late Show off casey's guide: 1 hidden");
      await C.pg.waitForTimeout(600);
      await C.toGuide();
      await C.shot("next-up");
      await C.wide("casey's hub");
      check(C.errorsOf().length === 0, "no page errors (casey)", C.errorsOf().join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await guideFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
