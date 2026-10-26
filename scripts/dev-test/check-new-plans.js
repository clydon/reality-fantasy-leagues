// Dev-only check for planned nights (docs/PLAN-new-design.md step 11 part 3; watch-plans.ts), against the dev server, on
// new-fixture.js's couch ("ZT Survivor 51": alex, riley, jordan and sam play it; casey is only on alex's other couch, ZT Extra)
// plus guide-fixture.js (ZT Late Show nightly, alex and riley watch it; ZT Drop Show, all eight at once in two days, riley and
// jordan watch it) and a stand-in TVmaze (fake-listings.js, through x-gys-listings) with one listing tomorrow at 9 PM.
//   API:
//   - what can be planned (GET /api/seasons/[id]/plans?couch=): from your next episode (sam, behind, gets aired ones as shared
//     starts only), the live airing only for one still to air and never for a streaming drop, who's on the couch and whether
//     they watch it; never a title; only for people on the couch;
//   - planning: the live airing (its time from the schedule), a shared start, the refusals (a second for the same episode,
//     bad requests, inviting yourself or someone off the couch, an aired episode live, a start in the past, before it's out,
//     more than two months on, an episode with no time, a streaming season live); one push each to those invited (`told`);
//   - the home read's plans (yours, the invited's, someone on the couch not invited, nobody on another couch), answers (I'm
//     in, Can't make it, someone not invited joining, the host can't say no, nobody off the couch), the hub's feed line, a
//     live plan following the schedule when it moves, calling it off (only whoever planned it), Undo, Undo refused once
//     someone has planned that episode since, and a night that's over.
//   In a real browser at --width (390 by default): as alex, Tonight's plate (Open stays Preview: watching together is step 13 part 3's),
//   the ⋯ menu's Plan a watch along (the episode chips, the planned one shown as it stands, the live airing, a shared start's
//   day and time, the invite chips), sending it, the plan's sheet (who's in, Call it off with the toast's Undo), the hub's
//   guide (an airing tagged Watch along, a shared start as a card of its own that opens the plan, I'm in from it), a couch
//   show's sheet planning one, a TV listing's Plan a watch along (added to his shows first), the feed's line; as riley, I'm
//   in on an invite's plate; as casey (another couch), none of it. Nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-plans.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and guide-fixture.js up and takes them down (--keep leaves them); touches zt
// rows only, plus its own tv_listings row (a stand-in show, id 990120); refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const guideFixture = require("./guide-fixture");
const fakeListings = require("./fake-listings");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-plans runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-plans.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const LISTING = 990120;

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
    const { late, drop } = gd.seasons;
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/pluribus.jpg' WHERE slug = 'zt-gd-drop-show'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/late-night.jpg' WHERE slug = 'zt-gd-late-show'`);
    for (const u of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);

    // A TV listing tomorrow at 9 PM: in the stand-in TVmaze (Add to my shows reads it) and in tv_listings (the guide's Also on).
    const tomorrow9 = new Date();
    tomorrow9.setDate(tomorrow9.getDate() + 1);
    tomorrow9.setHours(21, 0, 0, 0);
    const night = fakeListings.oneNight(LISTING, "ZT Plan Night", tomorrow9, { weight: 100, art: "/mock/showcase/art/amazing-race.jpg" });
    const tv = await fakeListings.start({ shows: [...fakeListings.shows(), night] });
    closers.push(tv.close);
    const H = { "x-gys-listings": tv.url };
    const ep = night.seasons[0].episodes[0];
    await pool.query("DELETE FROM tv_listings WHERE tvmaze_id = $1", [LISTING]);
    await pool.query(
      `INSERT INTO tv_listings (episode_id, day, tvmaze_id, air_at, runtime_min, season, number, binge, name, type, network, country, weight, art_url)
       VALUES ($1, $2, $3, $4, 60, 1, 1, false, 'ZT Plan Night', 'Reality', 'ZT Network', 'US', 100, $5)`,
      [ep.id, fakeListings.eastern(tomorrow9.getTime()).date, LISTING, tomorrow9, "/mock/showcase/art/amazing-race.jpg"]
    );

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD, headers: H });
    const options = (who, season = sid, couch = fx.couchId) => as[who].call("GET", `/api/seasons/${season}/plans${couch ? `?couch=${couch}` : ""}`);
    const plan = (who, body, season = sid, couch = fx.couchId) => as[who].call("POST", `/api/seasons/${season}/plans?couch=${couch}`, body);
    const act = (who, id, body) => as[who].call("POST", `/api/plans/${id}`, body);
    const home = async (who) => (await as[who].call("GET", "/api/me/home")).body;
    const NOT_SAID = /"(title|note|out|result|results|exits?)"/;

    // ---------- what can be planned ----------
    let r = await options("alex");
    const o = r.body;
    check(r.status === 200 && o.from === 6 && o.episodes[0].number === 6 && o.episodes[0].live === true && !o.episodes[0].aired, "alex (seen 5): from Episode 6, its live airing can be planned", JSON.stringify(o.episodes?.[0]));
    check(o.episodes.length <= 6 && o.episodes.every((e, i) => e.number === 6 + i && e.airAt), "up to six episodes from his next, each with its time", o.episodes.map((e) => e.number).join());
    const names = o.people.map((p) => p.name).sort().join();
    check(names === ["jordan", "riley", "sam"].map(fixture.username).sort().join() && o.people.every((p) => p.watches), "everyone else on the couch, each watching it (they play it)", JSON.stringify(o.people));
    check(o.plans.length === 0 && o.blocked === null && o.release === "weekly", "nothing planned yet");
    check(!NOT_SAID.test(JSON.stringify(o)), "never a title (or a result)", (NOT_SAID.exec(JSON.stringify(o)) || [""])[0]);
    const ep6At = o.episodes[0].airAt;
    const ep7At = o.episodes[1].airAt;
    r = await options("sam");
    check(r.body.from === 4 && r.body.episodes[0].aired && !r.body.episodes[0].live && r.body.episodes.find((e) => e.number === 6)?.live, "sam (seen 3): from Episode 4, aired ones only as a shared start", JSON.stringify(r.body.episodes?.slice(0, 3)));
    check((await options("alex", sid, null)).status === 400, "which couch? 400");
    r = await options("alex", sid, fx.extraCouchId);
    check(r.status === 200 && r.body.people.map((p) => p.name).join() === fixture.username("casey"), "alex's other couch: casey is who's on it");
    check((await options("riley", sid, fx.extraCouchId)).status === 404, "a couch you're not on: 404");
    check((await options("alex", "not-a-season")).status === 404, "a season that isn't one: 404");
    r = await options("riley", drop);
    check(r.status === 200 && r.body.release === "binge" && r.body.episodes.every((e) => !e.live && e.airAt === gd.dropAt), "a streaming season: every episode at the drop, never a live airing", JSON.stringify(r.body.episodes?.slice(0, 2)));

    // ---------- planning ----------
    r = await plan("alex", { episode: 6, how: "live", invite: [U.riley, U.jordan] });
    const p1 = r.body.plan;
    check(r.status === 200 && r.body.told === 2 && p1.how === "live" && p1.startsAt === ep6At && p1.you === "host", "alex plans Episode 6's live airing, inviting riley and jordan: two pushes", JSON.stringify(r.body).slice(0, 300));
    check(p1.people.map((x) => `${x.name}:${x.answer}`).join() === [`${fixture.username("alex")}:in`, `${fixture.username("jordan")}:invited`, `${fixture.username("riley")}:invited`].join(), "he's in; they're invited", JSON.stringify(p1.people));
    check(r.body.plans.some((x) => x.id === p1.id), "the answer carries his plans for the home");
    check(!NOT_SAID.test(JSON.stringify(r.body)), "a plan carries no title or result");
    r = await plan("riley", { episode: 6, how: "start", startsAt: new Date(Date.parse(ep6At) + 2 * HOUR).toISOString(), invite: [U.alex] });
    check(r.status === 409 && /already a watch along for Episode 6/.test(r.body.error), "a second for the same episode: 409", JSON.stringify(r.body));
    const refuse = async (body, status, re, what) => {
      const x = await plan("alex", body);
      check(x.status === status && (!re || re.test(x.body.error)), what, `${x.status} ${JSON.stringify(x.body)}`);
    };
    await refuse({ episode: "six", how: "live", invite: [U.riley] }, 400, /Which episode/, "a bad episode: 400");
    await refuse({ episode: 7, how: "later", invite: [U.riley] }, 400, /how must be/, "a bad how: 400");
    await refuse({ episode: 7, how: "live", invite: [] }, 400, /Invite someone/, "nobody invited: 400");
    await refuse({ episode: 7, how: "live", invite: [U.alex] }, 400, /not yourself/, "inviting yourself: 400");
    await refuse({ episode: 7, how: "live", invite: [U.casey] }, 400, /on the couch/, "inviting someone off the couch: 400");
    await refuse({ episode: 5, how: "live", invite: [U.riley] }, 409, /has aired/, "an aired episode's live airing: 409");
    await refuse({ episode: 7, how: "start", startsAt: new Date(Date.now() - HOUR).toISOString(), invite: [U.riley] }, 409, /still to come/, "a start in the past: 409");
    await refuse({ episode: 7, how: "start", startsAt: new Date(Date.parse(ep7At) - HOUR).toISOString(), invite: [U.riley] }, 409, /isn't out until/, "a start before it's out: 409");
    await refuse({ episode: 13, how: "start", startsAt: new Date(Date.now() + 70 * DAY).toISOString(), invite: [U.riley] }, 409, /two months/, "more than two months on: 409");
    await refuse({ episode: 40, how: "start", startsAt: new Date(Date.now() + DAY).toISOString(), invite: [U.riley] }, 409, /no time yet/, "an episode with no time: 409");
    await refuse({ episode: 7, how: "start", invite: [U.riley] }, 400, /startsAt/, "a start with no time: 400");
    r = await plan("riley", { episode: 1, how: "live", invite: [U.jordan] }, drop);
    check(r.status === 409 && /streaming/.test(r.body.error), "a streaming season live: 409", JSON.stringify(r.body));
    check((await plan("casey", { episode: 7, how: "live", invite: [U.alex] })).status === 404, "someone off the couch can't plan on it");
    check(Number((await pool.query("SELECT count(*) FROM watch_plans WHERE couch_id = $1", [fx.couchId])).rows[0].count) === 1, "only the one plan was made");

    // ---------- the home read ----------
    let h = await home("alex");
    check(h.plans.length === 1 && h.plans[0].id === p1.id && h.plans[0].you === "host" && h.plans[0].label === "ZT Survivor 51", "alex's home has it (his)", JSON.stringify(h.plans).slice(0, 200));
    check((await home("riley")).plans.find((x) => x.id === p1.id)?.you === "invited", "riley's: invited");
    check((await home("sam")).plans.find((x) => x.id === p1.id)?.you === null, "sam's (on the couch, not invited): his to join");
    check(!(await home("casey")).plans.some((x) => x.id === p1.id), "casey's (another couch): not there");
    check(!NOT_SAID.test(JSON.stringify(h.plans)), "no titles in the home's plans");

    // ---------- answers ----------
    r = await act("riley", p1.id, { answer: "in" });
    check(r.status === 200 && r.body.plan.people.find((x) => x.userId === U.riley)?.answer === "in" && r.body.plan.you === "in", "riley: I'm in", JSON.stringify(r.body).slice(0, 200));
    r = await act("jordan", p1.id, { answer: "out" });
    check(r.status === 200 && r.body.plan.you === "out", "jordan: Can't make it");
    r = await act("sam", p1.id, { answer: "in" });
    const samRow = r.body.plan?.people.find((x) => x.userId === U.sam);
    check(r.status === 200 && samRow?.answer === "in" && samRow.invited === false, "sam joins it (not invited)", JSON.stringify(samRow));
    r = await act("alex", p1.id, { answer: "out" });
    check(r.status === 409 && /call it off/.test(r.body.error), "the host can't say Can't make it: 409", JSON.stringify(r.body));
    check((await act("casey", p1.id, { answer: "in" })).status === 404, "someone off the couch: 404");
    check((await act("riley", p1.id, { answer: "maybe" })).status === 400 && (await act("riley", p1.id, {})).status === 400, "a bad answer: 400");
    check((await act("riley", "nope", { answer: "in" })).status === 404, "a plan that isn't one: 404");

    // ---------- the hub's feed ----------
    let feed = (await as.jordan.call("GET", `/api/couches/${fx.couchId}/hub`)).body.feed;
    let line = feed.find((x) => x.id === `plan-${p1.id}`);
    check(
      !!line && line.kind === "planned" && line.userId === U.alex && line.label === "ZT Survivor 51" && line.episode === 6 && line.how === "live" && line.startsAt === ep6At && line.going === 3,
      "the feed: alex planned a watch along · ZT Survivor 51 · Ep 6 · the live airing · 3 going",
      JSON.stringify(line)
    );

    // ---------- the live airing follows the schedule ----------
    await pool.query("UPDATE show_seasons SET air_time = air_time + interval '30 minutes' WHERE id = $1", [sid]);
    h = await home("alex");
    check(Date.parse(h.plans[0].startsAt) - Date.parse(ep6At) === 30 * 60_000, "the airing moves half an hour: the plan moves with it", h.plans[0].startsAt);
    await pool.query("UPDATE show_seasons SET air_time = air_time - interval '30 minutes' WHERE id = $1", [sid]);

    // ---------- calling it off, Undo ----------
    check((await act("riley", p1.id, { cancel: true })).status === 403, "only whoever planned it calls it off: 403");
    r = await act("alex", p1.id, { cancel: true });
    check(r.status === 200 && !r.body.plans.some((x) => x.id === p1.id), "alex calls it off: gone from his plans");
    check(!(await home("riley")).plans.some((x) => x.id === p1.id), "and riley's");
    feed = (await as.jordan.call("GET", `/api/couches/${fx.couchId}/hub`)).body.feed;
    check(!feed.some((x) => x.id === `plan-${p1.id}`), "and the feed's");
    r = await act("riley", p1.id, { answer: "in" });
    check(r.status === 409 && /called off/.test(r.body.error), "answering a called-off night: 409");
    r = await plan("riley", { episode: 6, how: "start", startsAt: new Date(Date.parse(ep6At) + 2 * HOUR).toISOString(), invite: [U.alex] });
    const p2 = r.body.plan;
    check(r.status === 200 && p2.how === "start", "with it called off, riley can plan Episode 6 (a shared start)");
    r = await act("alex", p1.id, { cancel: false });
    check(r.status === 409 && /planned Episode 6 since/.test(r.body.error), "so alex's Undo is refused: 409", JSON.stringify(r.body));
    check((await act("riley", p2.id, { cancel: true })).status === 200, "riley calls hers off");
    r = await act("alex", p1.id, { cancel: false });
    check(
      r.status === 200 && r.body.plans.some((x) => x.id === p1.id) && r.body.plan.people.map((x) => x.answer).join() === "in,in,in,out",
      "Undo brings alex's back, with everyone's answers",
      JSON.stringify(r.body.plan?.people)
    );

    // ---------- a night that's over ----------
    r = await plan("alex", { episode: 5, how: "start", startsAt: new Date(Date.now() + HOUR).toISOString(), invite: [U.sam] });
    const p3 = r.body.plan;
    check(r.status === 200 && p3.how === "start" && p3.episode === 5, "an aired episode as a shared start (sam is behind)");
    await pool.query("UPDATE watch_plans SET starts_at = now() - interval '3 hours' WHERE id = $1", [p3.id]);
    check(!(await home("alex")).plans.some((x) => x.id === p3.id), "once it's over it leaves the home");
    r = await act("sam", p3.id, { answer: "in" });
    check(r.status === 409 && /over/.test(r.body.error), "and can't be answered: 409");
    await pool.query("DELETE FROM watch_plans WHERE id = $1", [p3.id]);

    // For the browser: riley plans tonight's Late Show (alex's too: the airing gets its tag) and jordan a shared start of the
    // Drop Show three hours after it drops (a card of its own on alex's guide).
    const lateOpts = (await options("riley", late)).body;
    const lateEp = lateOpts.episodes.find((e) => e.live);
    r = await plan("riley", { episode: lateEp.number, how: "live", invite: [U.alex] }, late);
    const pLate = r.body.plan;
    check(r.status === 200 && pLate.startsAt === lateEp.airAt, "riley plans the Late Show's next airing, inviting alex");
    const dropStart = new Date(Date.parse(gd.dropAt) + 3 * HOUR).toISOString();
    r = await plan("jordan", { episode: 1, how: "start", startsAt: dropStart, invite: [U.alex, U.riley] }, drop);
    const pDrop = r.body.plan;
    check(r.status === 200 && pDrop.startsAt === dropStart, "jordan plans the Drop Show's Episode 1, three hours after it drops");

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
        // Motion off, so a capture sees where a push lands; reduced motion too, so the guide holds still.
        const b = await open({ user: fixture.username(who), pass: PASSWORD, width, height: 844, motion: "off", headers: H });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const pg = b.page;
        return {
          b,
          pg,
          shot: async (name) => {
            await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
            await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`) });
          },
          wide: async (what) => {
            const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
          },
          errors: () => b.errors.filter((e) => !/Failed to load resource/.test(e)).concat(b.errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon)),
          toast: () => pg.locator("[role=status]").last(),
          sheet: () => pg.locator("[role=dialog][data-open]"),
          closed: () => pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {}),
          toGuide: async () => {
            await pg.locator("[data-guide]").scrollIntoViewIfNeeded();
            await pg.evaluate(() => window.scrollBy(0, -70));
          },
          // Bring a card into the reel's view.
          reelTo: (sel) => pg.evaluate((s) => {
            const el = document.querySelector(s);
            const reel = document.querySelector("[data-guide] .overflow-x-auto");
            if (el && reel) reel.scrollLeft = Math.max(0, el.closest("[data-guide-day]").offsetLeft - 8);
          }, sel),
        };
      };
      const statuses = async (pg) => (await pg.locator("[role=status]").allTextContents()).join(" | ");
      const planRow = async (id) => (await pool.query("SELECT * FROM watch_plans WHERE id = $1", [id])).rows[0];

      // ---------- alex: Tonight ----------
      const A = await browse("alex");
      const pg = A.pg;
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const plate = pg.locator(`[data-plan="${p1.id}"]`);
      await plate.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const plateText = await plate.innerText();
      check(/Episode 6/.test(plateText) && /live airing/i.test(plateText) && (await plate.getAttribute("data-plan-you")) === "host", "Tonight: his plan's plate (Episode 6, the live airing)", plateText);
      check((await plate.locator("[data-plan-together]").count()) === 1 && (await pg.locator("[data-preview='show.watch-together']").count()) === 0, "its Open is the night's watch along, together (step 13 part 3: no Preview)");
      check((await pg.locator("[data-plan-invite]").count()) === 0, "no Plan a watch along row: Episode 6 has one");
      await plate.scrollIntoViewIfNeeded();
      await A.shot("tonight-plate");
      await A.wide("Tonight with a plan");

      // The ⋯ menu: Plan a watch along.
      await pg.locator('button[aria-label^="Show menu"]').click();
      await A.sheet().getByRole("button", { name: /Plan a watch along/ }).click();
      const ps = pg.locator("[data-plan-sheet='ready']");
      await ps.waitFor({ timeout: 20_000 });
      check(/Ep 6 · planned/.test(await pg.locator("[data-plan-episode='6']").innerText()), "the sheet: Episode 6 says planned");
      check((await pg.locator(`[data-plan-existing="${p1.id}"]`).count()) === 1, "and, picked (his next), shows the plan as it stands");
      await pg.waitForTimeout(400);
      await A.shot("plan-sheet-planned");
      await pg.locator("[data-plan-episode='7']").click();
      check((await pg.locator("[data-how='live']").getAttribute("aria-pressed")) === "true", "Episode 7: the live airing first");
      check((await pg.locator("[data-plan-person]").evaluateAll((xs) => xs.filter((x) => x.getAttribute("aria-pressed") === "true").length)) === 3, "everyone who watches it, invited by default");
      await pg.locator("[data-how='start']").click();
      await pg.locator("[data-plan-times]").waitFor();
      const picked = await pg.locator("[data-plan-time][aria-pressed='true']").getAttribute("data-plan-time");
      check(picked === "9:00 PM", "a shared start: 9:00 PM by default", picked);
      // A day and a time of his own (step 13 part 3): five days after it airs (past the four offered), at 2:30 in the afternoon.
      const own7 = new Date(Date.parse(ep7At));
      own7.setHours(0, 0, 0, 0);
      own7.setDate(own7.getDate() + 5);
      const ymd = `${own7.getFullYear()}-${String(own7.getMonth() + 1).padStart(2, "0")}-${String(own7.getDate()).padStart(2, "0")}`;
      await pg.locator("[data-plan-day='own']").click();
      await pg.locator("[data-plan-date]").fill(ymd);
      await pg.locator("[data-plan-time='own']").click();
      await pg.locator("[data-plan-clock]").fill("14:30");
      await pg.waitForTimeout(300);
      check(
        (await pg.locator("[data-plan-day='own']").getAttribute("aria-pressed")) === "true" && /2:30 PM/.test(await pg.locator("[data-plan-time='own']").innerText()) && (await pg.locator("[data-plan-time][aria-pressed='true']").count()) === 1,
        "Another day and Another time: his own, the chips say so",
        await pg.locator("[data-plan-time='own']").innerText()
      );
      await pg.locator("[data-plan-clock]").fill("23:59");
      await pg.locator("[data-plan-date]").fill("2020-01-01");
      await pg.waitForTimeout(200);
      check((await pg.locator("[data-plan-send]").isDisabled()) && (await pg.locator("[data-plan-when-bad]").count()) === 1, "a day gone by: Send waits, and says why");
      await pg.locator("[data-plan-date]").fill(ymd);
      await pg.locator("[data-plan-clock]").fill("14:30");
      await pg.locator(`[data-plan-person="${fixture.username("sam")}"]`).click();
      await pg.waitForTimeout(300);
      await A.shot("plan-sheet-start");
      await A.wide("the plan sheet");
      await pg.locator("[data-plan-send]").click();
      await A.closed();
      await pg.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((x) => /Invites sent/.test(x.textContent)), null, { timeout: 10_000 }).catch(() => {});
      check(/Invites sent · ZT Survivor 51 Episode 7/.test(await statuses(pg)), "Send invites: the toast says so", await statuses(pg));
      const p7 = (await pool.query("SELECT * FROM watch_plans WHERE couch_id = $1 AND season_id = $2 AND episode = 7 AND cancelled_at IS NULL", [fx.couchId, sid])).rows[0];
      const want7 = new Date(own7);
      want7.setHours(14, 30, 0, 0);
      check(!!p7 && p7.how === "start" && new Date(p7.starts_at).getTime() === want7.getTime(), "saved: Episode 7 together at 2:30 PM, five days after it airs", p7 && new Date(p7.starts_at).toISOString());
      const invited7 = (await pool.query("SELECT user_id, answer FROM watch_plan_people WHERE plan_id = $1", [p7?.id])).rows;
      check(invited7.length === 3 && !invited7.some((x) => x.user_id === U.sam), "riley and jordan invited, not sam (he took sam off)", JSON.stringify(invited7));
      await pg.locator(`[data-plan="${p7?.id}"]`).waitFor({ timeout: 10_000 }).catch(() => {});
      check((await pg.locator("[data-planned-nights] [data-plan]").count()) === 2, "Tonight: two plates now");

      // The plan's sheet: who's in, Call it off and Undo.
      await plate.locator("[data-plan-open]").click();
      const detail = pg.locator(`[data-plan-detail="${p1.id}"]`);
      await detail.waitFor();
      const rows = await detail.locator("[data-plan-row]").evaluateAll((xs) => xs.map((x) => `${x.getAttribute("data-plan-row")}:${x.getAttribute("data-answer")}`));
      check(rows.join() === [`${fixture.username("alex")}:in`, `${fixture.username("riley")}:in`, `${fixture.username("sam")}:in`, `${fixture.username("jordan")}:out`].join(), "the plan's sheet: alex planned it, riley and sam in, jordan can't", rows.join());
      check(/Planned it/.test(await detail.innerText()) && /Can.t make it/.test(await detail.innerText()), "in words");
      await pg.waitForTimeout(400);
      await A.shot("plan-detail");
      await detail.locator("[data-plan-cancel]").click();
      await A.closed();
      await pg.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((x) => /called off/.test(x.textContent)), null, { timeout: 10_000 }).catch(() => {});
      check(!!(await planRow(p1.id)).cancelled_at && (await pg.locator(`[data-plan="${p1.id}"]`).count()) === 0, "Call it off: gone from Tonight, cancelled in the database");
      check((await pg.locator("[data-plan-invite]").count()) === 1, "and Plan a watch along is back for Episode 6");
      await A.toast().getByRole("button", { name: "Undo" }).click();
      await plate.waitFor({ timeout: 10_000 }).catch(() => {});
      check(!(await planRow(p1.id)).cancelled_at && (await plate.count()) === 1, "the toast's Undo brings it back");

      // ---------- alex: the guide ----------
      await pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await pg.locator("[data-guide-day='0']").waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const ep6Card = pg.locator(`[data-guide-card="${sid}:6"]`);
      check((await ep6Card.getAttribute("data-plan")) === p1.id && (await ep6Card.locator("[data-plan-tag]").innerText()).trim().toLowerCase() === "watch along", "Survivor's Episode 6 card is tagged Watch along");
      const lateCard = pg.locator(`[data-guide-card="${late}:${lateEp.number}"]`);
      check((await lateCard.getAttribute("data-plan")) === pLate.id, "and the Late Show's airing riley planned");
      const dropPlan = pg.locator(`[data-guide-card="plan:${pDrop.id}"]`);
      check((await dropPlan.count()) === 1 && /watch along · ep 1/i.test(await dropPlan.locator("[data-plan-tag]").innerText()), "jordan's shared start of the Drop Show: a card of its own (Watch along · Ep 1)");
      check(/you \+|zt_nd_jordan/.test(await dropPlan.innerText()), "with who's in", await dropPlan.innerText());
      const opacity = await dropPlan.evaluate((el) => getComputedStyle(el).opacity);
      check(opacity === "1", "not faded: alex is invited", opacity);
      check(!/Secret/.test(await pg.locator("[data-guide]").innerText()), "no episode titles on the guide");
      await A.toGuide();
      await A.reelTo(`[data-guide-card="plan:${pDrop.id}"]`);
      await A.shot("guide-plan-card");
      await A.reelTo(`[data-guide-card="${sid}:6"]`);
      await A.shot("guide-tagged-airing");
      await A.wide("the hub with planned nights");

      // A plan card opens the plan: I'm in.
      await dropPlan.click();
      const dd = pg.locator(`[data-plan-detail="${pDrop.id}"]`);
      await dd.waitFor();
      await pg.waitForTimeout(300);
      await A.shot("guide-plan-sheet");
      await dd.locator("[data-plan-yes]").click();
      await pg.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((x) => /You're in/.test(x.textContent)), null, { timeout: 10_000 }).catch(() => {});
      check((await pool.query("SELECT answer FROM watch_plan_people WHERE plan_id = $1 AND user_id = $2", [pDrop.id, U.alex])).rows[0]?.answer === "in", "I'm in from the guide's card: saved");
      await pg.keyboard.press("Escape");
      await A.closed();
      check(/you \+/.test(await dropPlan.innerText()), "the card says you + who else now", await dropPlan.innerText());

      // A couch show's sheet: the Traitors (riley watches it) plans one.
      const tCard = pg.locator(`[data-guide-card^="${tsid}:"]`).first();
      await A.reelTo(`[data-guide-card^="${tsid}:"]`);
      await tCard.click();
      await pg.locator(`[data-guide-sheet="${tsid}"]`).waitFor();
      await pg.locator("[data-guide-plan]").click();
      await pg.locator("[data-plan-sheet='ready']").waitFor({ timeout: 20_000 });
      check((await pg.locator("[data-how='live']").getAttribute("aria-pressed")) === "true", "from a couch show's sheet: Plan a watch along, the live airing");
      check((await pg.locator(`[data-plan-person="${fixture.username("riley")}"]`).getAttribute("aria-pressed")) === "true", "riley (who watches it) invited");
      await pg.waitForTimeout(300);
      await A.shot("couch-show-plan");
      await pg.locator("[data-plan-send]").click();
      await A.closed();
      const pT = (await pool.query("SELECT * FROM watch_plans WHERE couch_id = $1 AND season_id = $2 AND cancelled_at IS NULL", [fx.couchId, tsid])).rows[0];
      check(!!pT && pT.how === "live" && pT.created_by === U.alex, "saved: the Traitors' airing");
      await pg.waitForFunction((id) => !!document.querySelector(`[data-guide-card][data-plan="${id}"]`), pT?.id, { timeout: 10_000 }).catch(() => {});
      check((await tCard.getAttribute("data-plan")) === pT?.id, "its card is tagged now");
      await tCard.click();
      await pg.locator(`[data-guide-sheet="${tsid}"] [data-plan="${pT?.id}"]`).waitFor({ timeout: 10_000 }).catch(() => {});
      check((await pg.locator(`[data-guide-sheet="${tsid}"] [data-plan]`).count()) === 1 && (await pg.locator("[data-guide-plan]").count()) === 0, "the sheet shows the plan, and no second Plan a watch along");
      await pg.waitForTimeout(300);
      await A.shot("couch-show-sheet-planned");
      await pg.keyboard.press("Escape");
      await A.closed();

      // A TV listing: Plan a watch along adds it to his shows first.
      const lst = pg.locator(`[data-also-on='1'] [data-tvmaze='${LISTING}']`);
      await lst.waitFor({ timeout: 15_000 });
      await A.reelTo(`[data-also-on='1'] [data-tvmaze='${LISTING}']`);
      await lst.click();
      await pg.locator(`[data-listing-sheet='${LISTING}']`).waitFor();
      await pg.waitForTimeout(300);
      await A.shot("listing-sheet");
      await pg.locator("[data-listing-plan]").click();
      const where = pg.locator(`[data-add-listing='${LISTING}']`);
      await where.locator("[data-where-save]").waitFor({ timeout: 15_000 });
      await where.locator("[data-where-save]").click();
      await pg.locator("[data-plan-sheet='ready']").waitFor({ timeout: 20_000 });
      const added = (await pool.query("SELECT ss.id FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.tvmaze_id = $1", [LISTING])).rows[0];
      check(!!added && (await pool.query("SELECT following FROM show_follows WHERE user_id = $1 AND season_id = $2", [U.alex, added.id])).rows[0]?.following === true, "the listing's Plan a watch along: added to his shows first");
      check(/ZT Plan Night/.test(await A.sheet().innerText()) && (await pg.locator("[data-how='live']").getAttribute("aria-pressed")) === "true", "then the plan sheet for it: tomorrow's live airing");
      check((await pg.locator("[data-plan-person][aria-pressed='true']").count()) === 0 && (await pg.locator("[data-plan-send]").isDisabled()), "nobody watches it yet: nobody's invited until he picks (Send waits)");
      await pg.locator(`[data-plan-person="${fixture.username("jordan")}"]`).click();
      await pg.waitForTimeout(300);
      await A.shot("listing-plan-sheet");
      await pg.locator("[data-plan-send]").click();
      await A.closed();
      const pL = (await pool.query("SELECT * FROM watch_plans WHERE season_id = $1", [added?.id])).rows[0];
      check(!!pL && pL.how === "live" && new Date(pL.starts_at).getTime() === tomorrow9.getTime(), "saved: ZT Plan Night tomorrow at 9 PM, the live airing");

      // The feed.
      await pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await pg.locator("[data-feed-list] [data-feed]").first().waitFor({ timeout: 30_000 });
      const planned = pg.locator("[data-feed='planned']");
      const feedText = (await planned.allInnerTexts()).join(" | ");
      check((await planned.count()) >= 3 && /planned a watch along/.test(feedText) && /going/.test(feedText), "the feed: who planned a watch along, when, how many going", feedText.slice(0, 300));
      await planned.first().scrollIntoViewIfNeeded();
      await pg.waitForTimeout(300);
      await A.shot("feed");
      check(A.errors().length === 0, "no page errors (alex)", A.errors().join(" | "));

      // ---------- riley: I'm in from the plate ----------
      const R = await browse("riley");
      await R.pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const rPlate = R.pg.locator(`[data-plan="${p7?.id}"]`);
      await rPlate.waitFor({ timeout: 30_000 });
      await R.pg.waitForTimeout(800);
      check((await rPlate.getAttribute("data-plan-you")) === "invited" && /You.re invited/.test(await rPlate.innerText()), "riley's Tonight: Episode 7's plate, invited", await rPlate.innerText());
      await rPlate.scrollIntoViewIfNeeded();
      await R.shot("tonight-invited");
      await rPlate.locator("[data-plan-in]").click();
      await R.pg.waitForFunction((id) => document.querySelector(`[data-plan="${id}"]`)?.getAttribute("data-plan-you") === "in", p7?.id, { timeout: 10_000 }).catch(() => {});
      check((await rPlate.getAttribute("data-plan-you")) === "in" && /You're in/.test(await statuses(R.pg)), "I'm in: the plate says so, and the toast", await statuses(R.pg));
      await R.shot("tonight-in");
      check(R.errors().length === 0, "no page errors (riley)", R.errors().join(" | "));

      // ---------- casey: another couch ----------
      const C = await browse("casey");
      await C.pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await C.pg.locator("[data-guide-day='0']").waitFor({ timeout: 30_000 });
      await C.pg.waitForTimeout(800);
      check((await C.pg.locator("[data-guide-card][data-plan]").count()) === 0 && (await C.pg.locator("[data-feed='planned']").count()) === 0, "casey (alex's other couch): none of couch A's nights");
      check(C.errors().length === 0, "no page errors (casey)", C.errors().join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    await pool.query("DELETE FROM tv_listings WHERE tvmaze_id = $1", [LISTING]).catch((e) => console.error(e));
    if (!args.includes("--keep")) {
      await guideFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
