// Dev-only check for streaming shows and the rail (docs/PLAN-new-design.md step 14 part 1), against the dev server, on
// new-fixture.js's couch ("ZT Survivor 51": alex, riley, jordan and sam; casey on alex's other couch, "ZT Extra") plus
// streaming-fixture.js (seasons watched at your own pace: ZT Severed alex is on 3 of, ZT Fresh Drop sam's, ZT Old Wire a finished
// weekly season jordan watches with a planned night, ZT Done Binge alex finished and riley streams, ZT Coming Soon dropping in
// three days, ZT Alone Binge alex finished alone, ZT Secret Stream sam's private one) and solo-fixture.js (someone on no couch).
//   API:
//   - every season header carries its drop and its listing's service (home shows and couch shows, the space read);
//   - the release model: a streaming season is never on the air (Up next is its drop until then, nothing after; the watch card
//     says aired, never live, even minutes after the drop); a planned night on it is a shared start (the live airing: 409);
//   - privacy: sam's private Secret Stream in nobody else's home; casey sees only what alex (on her couch) streams;
//     On now names riley on Severed for the couch.
//   In a real browser at --width (390 by default), as alex: the rail under the guide in the mock's order (Severed's Continue ·
//   Ep 4 with his progress, Fresh Drop's new drop, Old Wire's planned night, Done Binge's "You finished it", Coming Soon's drop
//   day), See all 5 and its sheet, "1 waiting", riley is on now, a ＋ only on what isn't his, no Preview, a couch show hidden from
//   the guide off the rail too; Up next and The couch is
//   watching leave streaming to the rail, posters say the service or the drop day; each show space (the bar, the Streaming tag,
//   the drop plate and its countdown, Plan a watch along for the premiere with no live airing to pick, the phase head at your own
//   pace, You finished it with nothing to plan, the follow card's words, Episodes' "All 10 out · Apple TV+" from Episode 1 down
//   and the drop as one line); the ＋ on a new drop (where you are, then it's his, staying on the hub); a drop minutes old (no
//   On air anywhere, a new drop on the rail); as sam (his private one on his rail only); as casey; as zt_so_alex on the solo hub
//   ("Streaming", just him). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-streaming.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js, streaming-fixture.js and solo-fixture.js up and takes them down (--keep
// leaves them); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const streamingFixture = require("./streaming-fixture");
const soloFixture = require("./solo-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-streaming runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-streaming.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

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
    const st = await streamingFixture.up(pool, fx);
    const so = await soloFixture.up(pool);
    const S = st.seasons;
    for (const u of [...Object.values(fx.users), ...Object.values(so.users)]) {
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    }
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    const as = {};
    for (const who of ["alex", "riley", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });
    as.solo = await api({ user: soloFixture.username("alex"), pass: soloFixture.PASSWORD });
    const home = async (who) => (await as[who].call("GET", "/api/me/home")).body;
    const all = (h) => [...h.shows, ...h.couchShows];
    const of = (h, id) => all(h).find((s) => s.seasonId === id);
    const couchOf = (h, id) => h.couches.find((c) => c.id === id);

    // ---------- the season header: its drop and its service ----------
    let h = await home("alex");
    const sev = of(h, S.severed);
    check(sev?.release === "binge" && sev.dropAt && Math.abs(Date.parse(sev.dropAt) - (Date.now() - 20 * DAY)) < HOUR && sev.show.network === "Apple TV+", "Severed: a streaming season, its drop and its service on the home read", JSON.stringify({ r: sev?.release, d: sev?.dropAt, n: sev?.show.network }));
    const wire = of(h, S.wire);
    check(wire?.release === "weekly" && wire.dropAt === null && wire.status === "completed" && wire.show.network === "HBO Max", "Old Wire: a finished weekly season, no drop (a couch show for alex)", JSON.stringify(wire));
    const survivor = of(h, fx.seasonId);
    check(survivor && survivor.dropAt === null && survivor.show.network === null, "Survivor (no listing): no drop, no service");
    let r = await as.alex.call("GET", `/api/seasons/${S.soon}/space?couch=${fx.couchId}`);
    check(r.status === 200 && r.body.dropAt === st.dropAt.toISOString() && r.body.show.network === "HBO Max" && r.body.schedule.release === "binge", "the space read carries them too", JSON.stringify({ d: r.body.dropAt, n: r.body.show?.network }));

    // ---------- the release model: never on the air ----------
    check(sev.upNext === null && sev.latestAired === 10, "after the drop: nothing up next, all 10 out", JSON.stringify({ up: sev.upNext, a: sev.latestAired }));
    const soon = of(h, S.soon);
    check(soon?.upNext?.number === 1 && soon.upNext.live === false && soon.upNext.airAt === st.dropAt.toISOString() && soon.latestAired === 0, "before it: Episode 1 at the drop, not on the air", JSON.stringify(soon?.upNext));
    check(soon.week.length === 8 && soon.week.every((e) => e.airAt === st.dropAt.toISOString()), "the guide's week: all 8 at the drop (one card)", String(soon.week.length));
    r = await as.alex.call("GET", `/api/seasons/${S.severed}/watch?couch=${fx.couchId}`);
    check(r.status === 200 && r.body.episode === 4 && r.body.status === "aired", "Severed's watch along: alex's next (4), aired", JSON.stringify({ e: r.body.episode, s: r.body.status }));
    // A drop minutes old: once the old code put Episode 1 "on the air" for its first hour.
    await pool.query(`UPDATE show_seasons SET drop_at = now() - interval '5 minutes', premiere_date = current_date, status = 'completed' WHERE id = $1`, [S.fresh]);
    r = await as.sam.call("GET", `/api/seasons/${S.fresh}/watch?couch=${fx.couchId}`);
    check(r.status === 200 && r.body.episode === 3 && r.body.status === "aired", "five minutes after a drop: sam's next (3) is aired, never live", JSON.stringify({ e: r.body.episode, s: r.body.status }));
    let hs = await home("sam");
    check(of(hs, S.fresh)?.upNext === null && of(hs, S.fresh)?.latestAired === 6, "and nothing's up next or on now for it", JSON.stringify(of(hs, S.fresh)?.upNext));
    r = await as.sam.call("GET", `/api/seasons/${S.fresh}/plans?couch=${fx.couchId}`);
    check(r.status === 200 && r.body.release === "binge" && r.body.episodes.every((e) => !e.live), "the plan sheet's episodes: no live airing", JSON.stringify(r.body.episodes?.slice(0, 2)));
    r = await as.alex.call("POST", `/api/seasons/${S.soon}/plans?couch=${fx.couchId}`, { episode: 1, how: "live", invite: [fx.users.riley] });
    check(r.status === 409 && /no live airing/.test(r.body.error), "a streaming season's live airing: 409", JSON.stringify(r.body));
    const premiere = new Date(st.dropAt.getTime() + HOUR).toISOString();
    r = await as.alex.call("POST", `/api/seasons/${S.soon}/plans?couch=${fx.couchId}`, { episode: 1, how: "start", startsAt: premiere, invite: [fx.users.riley] });
    check(r.status === 200 && r.body.plans.some((p) => p.seasonId === S.soon && p.how === "start"), "the premiere as a shared start an hour after the drop", JSON.stringify(r.body).slice(0, 200));
    const premierePlan = r.body.plans?.find((p) => p.seasonId === S.soon);
    if (premierePlan) await as.alex.call("POST", `/api/plans/${premierePlan.id}`, { cancel: true });
    await pool.query(`UPDATE show_seasons SET drop_at = now() - interval '2 days', premiere_date = current_date - 2 WHERE id = $1`, [S.fresh]);

    // ---------- who streams what, as the guard lets out ----------
    h = await home("alex");
    const couch = couchOf(h, fx.couchId);
    const watching = (name, id) => couch.members.find((m) => m.name === fixture.username(name)).watching.includes(id);
    check(watching("riley", S.severed) && watching("jordan", S.severed) && watching("sam", S.fresh) && watching("jordan", S.wire) && watching("riley", S.soon), "the couch's open follows: riley and jordan on Severed, sam on Fresh Drop, jordan on Old Wire, riley on Coming Soon");
    check(!all(h).some((s) => s.seasonId === S.secret) && !couch.members.some((m) => m.watching.includes(S.secret)), "sam's private Secret Stream: nowhere in alex's home");
    hs = await home("sam");
    check(hs.shows.some((s) => s.seasonId === S.secret && s.private), "but on sam's own shows (privately)");
    const hc = await home("casey");
    const extra = couchOf(hc, fx.extraCouchId);
    check(of(hc, S.severed) && of(hc, S.soon) && !of(hc, S.fresh) && !of(hc, S.wire) && !extra.members.some((m) => m.watching.includes(S.fresh)), "casey (alex's other couch): what alex streams, not what couch A's others do");
    check(couch.members.every((m) => Object.keys(m).sort().join() === "joinedAt,name,role,userId,watching"), "nobody's progress in the home read (members carry what they watch, never how far)", JSON.stringify(couch.members[0]));
    // On now: riley watching along Severed's Episode 6 right now.
    const ws = (
      await pool.query(
        "INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, mode, clock_ms, running_since) VALUES ($1, 6, $2, $3, 'stream', 60000, now()) RETURNING id",
        [S.severed, fx.couchId, fx.users.riley]
      )
    ).rows[0].id;
    await pool.query("INSERT INTO watch_session_people (session_id, user_id) VALUES ($1, $2)", [ws, fx.users.riley]);
    r = await as.alex.call("GET", `/api/couches/${fx.couchId}/now`);
    const rileyOn = r.body.now?.find((w) => w.seasonId === S.severed);
    check(r.status === 200 && rileyOn?.name === fixture.username("riley") && rileyOn.episode === 6 && rileyOn.live === false, "On now: riley watching along Severed's Episode 6 (streaming: never 'live')", JSON.stringify(r.body.now));

    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      let n = 0;
      const browse = async (user, pass, tag) => {
        const b = await open({ user, pass, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const pg = b.page;
        const shot = async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((ok) => ((i.onload = ok), (i.onerror = ok), setTimeout(ok, 3000))))));
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${tag}-${name}.png`) });
        };
        const wide = async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
        };
        const errors = () => b.errors.filter((e) => !/Failed to load resource/.test(e)).concat(b.errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
        const text = async (sel) => ((await pg.locator(sel).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
        const hub = async () => {
          await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
          await pg.locator("[data-guide]").waitFor({ timeout: 30_000 });
          await pg.waitForTimeout(800);
        };
        const tonight = async (seasonId, sel = "[data-tab='tonight']") => {
          await pg.goto(`${BASE}/show/${seasonId}/tonight`, { waitUntil: "load" });
          await pg.locator(sel).first().waitFor({ timeout: 30_000 });
          await pg.locator("[data-couch-line]").waitFor({ timeout: 30_000 });
          await pg.waitForTimeout(800);
        };
        const status = () => pg.locator("header").first().locator("span.ml-auto").first().textContent().then((t) => (t ?? "").trim());
        return { pg, shot, wide, errors, text, hub, tonight, status };
      };

      // ---------- alex: the rail ----------
      const A = await browse(fixture.username("alex"), PASSWORD, "alex");
      const { pg } = A;
      await A.hub();
      const rail = pg.locator("[data-rail]");
      await rail.waitFor({ timeout: 30_000 });
      await rail.scrollIntoViewIfNeeded();
      const chips = () => rail.locator(".overflow-x-auto [data-rail-chip]");
      const order = await chips().evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-chip")));
      check(order.join() === [S.severed, S.fresh, S.wire, S.done, S.soon].join(), "the rail's order: yours in progress, a new drop, a planned night, the couch's, an upcoming drop", order.join());
      const ranks = await chips().evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-rank")));
      check(ranks.join() === "0,1,2,3,4", "their ranks", ranks.join());
      check(/Streaming on the couch/i.test(await A.text("[data-rail] h2")) && /See all 5/.test(await A.text("[data-rail-all]")), "Streaming on the couch, See all 5");
      check(!order.includes(S.alone) && !order.includes(S.secret), "not Alone Binge (finished, nobody else) nor sam's private one");
      check(order.indexOf(S.wire) > -1 && (await pg.locator("[data-guide]").evaluate((g, r) => !!(g.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING), await rail.elementHandle())), "under the guide");
      const chip = (id) => rail.locator(`.overflow-x-auto [data-rail-chip="${id}"]`);
      const tagOf = async (id) => [await chip(id).locator("[data-rail-tag]").getAttribute("data-rail-tag"), ((await chip(id).locator("[data-rail-tag]").textContent()) ?? "").trim()];
      let [kind, words] = await tagOf(S.severed);
      check(kind === "continue" && /^Continue · Ep 4$/i.test(words) && (await chip(S.severed).locator("[data-rail-progress]").getAttribute("data-rail-progress")) === "30", "Severed: Continue · Ep 4, his own progress (30%)", words);
      [kind, words] = await tagOf(S.fresh);
      check(kind === "new" && /New · all 6 out/i.test(words), "Fresh Drop: New · all 6 out", words);
      [kind, words] = await tagOf(S.wire);
      check(kind === "plan" && /^Watch along · \w{3} 9:00 PM$/i.test(words), "Old Wire: jordan's planned night", words);
      [kind, words] = await tagOf(S.done);
      check(kind === "finished" && /You finished it/i.test(words), "Done Binge: You finished it", words);
      [kind, words] = await tagOf(S.soon);
      check(kind === "drops" && /^Drops \w{3} 9:00 PM$/i.test(words), "Coming Soon: Drops <day> 9:00 PM", words);
      const who = async (id) => [await chip(id).locator("[data-rail-who]").getAttribute("data-rail-who"), ((await chip(id).locator("[data-rail-who]").textContent()) ?? "").trim()];
      check((await who(S.severed)).join("|") === `on|${fixture.username("riley")} is on now`, "Severed: riley is on now (On now's read)", (await who(S.severed)).join("|"));
      check((await who(S.soon)).join("|") === "waiting|1 waiting" && (await who(S.fresh)).join("|") === `names|${fixture.username("sam")}`, "Coming Soon: 1 waiting; Fresh Drop: sam");
      check((await rail.locator("[data-rail-add]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-add")))).sort().join() === [S.fresh, S.wire].sort().join(), "a ＋ only on what isn't his (Fresh Drop, Old Wire)");
      check((await rail.locator("[data-preview]").count()) === 0, "no Preview in the rail");
      check(!/Ep [0-9]+ of|ahead|caught up/i.test(await rail.textContent()), "nobody's progress on a chip");
      await pg.evaluate(() => window.scrollBy(0, -120));
      await A.shot("rail");
      await A.wide("the hub with the rail");
      // Up next, posters and The couch is watching leave streaming to the rail.
      const upNextHref = await pg.locator("[data-upnext] h2 a").getAttribute("href");
      check(!!upNextHref && ![S.severed, S.soon, S.done, S.alone].some((id) => upNextHref.includes(id)), "Up next isn't a streaming season", upNextHref);
      const posterLine = async (id) => ((await pg.locator(`[data-poster="${id}"] span.mt-1`).first().textContent()) ?? "").trim();
      check(/Season 2 · Apple TV\+/.test(await posterLine(S.severed)) && /Season 1 · drops \w{3}/.test(await posterLine(S.soon)), "posters: the service, or the drop day", `${await posterLine(S.severed)} / ${await posterLine(S.soon)}`);
      const watchedLabels = await pg.locator("[data-watched]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-watched")));
      check(!watchedLabels.some((l) => /Old Wire|Fresh Drop|Severed|Done Binge/.test(l)), "The couch is watching: weekly shows only", watchedLabels.join());
      // The guide: Coming Soon's drop day, one card.
      const dropCard = pg.locator(`[data-guide-card="${S.soon}:1"]`);
      check((await dropCard.getAttribute("data-drop")) === "8" && !(await dropCard.getAttribute("data-live")), "the guide: All 8 drop on its day, one card, not on the air");
      await pg.evaluate(() => window.scrollBy(0, 0));
      // See all.
      await pg.locator("[data-rail-all]").click();
      const sheet = pg.locator("[role=dialog][data-open]");
      await sheet.locator("[data-rail-sheet]").waitFor();
      check((await sheet.locator("[data-rail-chip]").count()) === 5 && /Every show the couch is streaming/.test(await sheet.textContent()), "See all: every chip, full width");
      await A.shot("see-all");
      await pg.keyboard.press("Escape");
      await sheet.waitFor({ state: "hidden" }).catch(() => {});
      // Hide from guide takes a couch show off the rail too; Show again brings it back.
      r = await as.alex.call("POST", "/api/me/guide/hidden", { seasonId: S.wire, hidden: true });
      check(r.status === 200, "alex hides Old Wire from his guide", JSON.stringify(r.body));
      await A.hub();
      await rail.waitFor({ timeout: 30_000 });
      const hiddenOrder = await chips().evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-chip")));
      check(!hiddenOrder.includes(S.wire) && hiddenOrder.length === 4 && /See all 4/.test(await A.text("[data-rail-all]")), "hidden from the guide: off the rail too (See all 4)", hiddenOrder.join());
      await as.alex.call("POST", "/api/me/guide/hidden", { seasonId: S.wire, hidden: false });
      await pool.query("DELETE FROM watch_sessions WHERE id = $1", [ws]);

      // ---------- the show space ----------
      // Severed: alex on 3.
      await A.tonight(S.severed, "[data-phase]");
      check(/All 10 episodes · Apple TV\+/.test(await A.status()), "Severed's bar: All 10 episodes · Apple TV+", await A.status());
      check((await pg.locator("[data-streaming]").count()) === 1 && (await pg.locator("[data-not-a-game]").count()) === 1, "the couch line: Streaming (and Not a game yet)");
      check(/Episode 4/i.test(await A.text("[data-phase]")) && /Your own pace/.test(await A.text("[data-phase]")), "the phase: Episode 4 · Your own pace", await A.text("[data-phase]"));
      check(!/On air/i.test(await pg.locator("main").textContent()), "nothing on the air");
      const card = pg.locator("[data-watch-card]");
      check((await card.getAttribute("data-watch-card")) === "4" && /Episode 4 · your own pace/i.test(await card.textContent()), "Watch along: Episode 4 · your own pace", await card.textContent());
      const leadsExtras = await pg.evaluate(() => {
        const c = document.querySelector("[data-watch-card]");
        const extras = [...document.querySelectorAll("h2")].find((x) => /Extras this week/i.test(x.textContent));
        return !!c && !!extras && !!(c.compareDocumentPosition(extras) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      check(leadsExtras, "and it leads Tonight (above the Extras)");
      check((await pg.locator(`[data-plan="${st.plans.severed}"]`).count()) === 1 && (await pg.locator("[data-plan-invite]").count()) === 1 && /Pick a time, start at the same moment/.test(await A.text("[data-plan-invite]")), "riley's Episode 7 night, and Plan a watch along (a shared start)");
      check(/at their own pace/.test(await pg.locator("h2", { hasText: /Who's watching/i }).locator("xpath=..").textContent()), "Who's watching: at their own pace");
      await A.shot("severed-tonight");
      await pg.locator("[data-whos-watching]").scrollIntoViewIfNeeded();
      await A.shot("severed-tonight-2");
      await A.wide("Severed's Tonight");

      // Coming Soon: before the drop.
      await A.tonight(S.soon, "[data-drop-plate]");
      check(/^Drops in 3 days$/.test(await A.status()), "Coming Soon's bar: Drops in 3 days", await A.status());
      const plate = await A.text("[data-drop-plate]");
      check(/All 8 episodes at once/i.test(plate) && /Drops \w{3} 9:00 PM/i.test(plate) && /in 3 days/.test(plate) && new RegExp(`HBO Max · ${fixture.username("riley")} is waiting for it`).test(plate), "the drop plate: all 8 at once, when, the countdown, the service and who's waiting", plate);
      check((await pg.locator("[data-phase]").count()) === 0 && (await pg.locator("[data-watch-card]").count()) === 0, "no phase head and no watch along to open yet");
      check(/Plan a watch along for the premiere/.test(await A.text("[data-plan-invite]")), "Plan a watch along for the premiere");
      await A.shot("soon-tonight");
      await pg.locator("[data-plan-invite]").click();
      const planSheet = pg.locator("[role=dialog][data-open]");
      await planSheet.locator("[data-how='start']").waitFor({ timeout: 15_000 });
      check((await planSheet.locator("[data-how='live']").count()) === 0 && /It drops \w{3} 9:00 PM · one shared start/.test(await planSheet.textContent()), "its plan sheet: no live airing, a shared start from the drop", (await planSheet.textContent()).slice(0, 200));
      await A.shot("soon-plan");
      await pg.keyboard.press("Escape");
      await planSheet.waitFor({ state: "hidden" }).catch(() => {});

      // Fresh Drop: not his yet.
      await A.tonight(S.fresh, "[data-follow-card]");
      const follow = await A.text("[data-follow-card]");
      check(new RegExp(`${fixture.username("sam")} is streaming this`).test(follow) && /All 6 episodes are out\. Add it to watch along with their reactions, at your own pace\./.test(follow), "Fresh Drop's follow card: sam is streaming this, all 6 are out", follow);
      check(/All 6 episodes are out/i.test(await A.text("[data-phase]")) && /All 6 episodes · Netflix/.test(await A.status()), "the phase and bar: all 6 out on Netflix");
      await A.shot("fresh-tonight");

      // Old Wire: a finished weekly season.
      await A.tonight(S.wire, "[data-phase]");
      check(/All 13 episodes are out/i.test(await A.text("[data-phase]")) && /All 13 episodes · HBO Max/.test(await A.status()) && (await pg.locator("[data-streaming]").count()) === 0, "Old Wire: all 13 out at your own pace, no Streaming tag (it aired weekly)");
      check(new RegExp(`${fixture.username("jordan")} watches this`).test(await A.text("[data-follow-card]")), "jordan watches this");

      // Done Binge: finished.
      await A.tonight(S.done, "[data-phase]");
      check(/You finished it/i.test(await A.text("[data-phase]")) && /All 8 episodes/.test(await A.text("[data-phase]")) && (await pg.locator("[data-plan-invite]").count()) === 0, "Done Binge: You finished it, nothing to plan");
      await A.shot("done-tonight");

      // Episodes.
      await pg.goto(`${BASE}/show/${S.severed}/episodes`, { waitUntil: "load" });
      await pg.locator("[data-episodes-aside]").waitFor({ timeout: 30_000 });
      await pg.locator("[data-ep-aired]").first().waitFor({ timeout: 30_000 });
      check(/All 10 out · Apple TV\+/.test(await A.text("[data-episodes-aside]")), "Severed's Episodes: All 10 out · Apple TV+");
      const eps = await pg.locator("[data-ep-aired]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-ep-aired")));
      check(eps.join() === "1,2,3,4,5,6,7,8,9,10" && !/Aired /.test(await pg.locator("main").textContent()), "from Episode 1 down, without the same drop time on every row", eps.join());
      check((await pg.locator("[data-ep-aired][data-watched='yes']").count()) === 3, "alex has seen 3");
      await A.shot("severed-episodes");
      await pg.goto(`${BASE}/show/${S.soon}/episodes`, { waitUntil: "load" });
      await pg.locator("[data-ep-to-air='drop']").waitFor({ timeout: 30_000 });
      check(/All 8 drop \w{3}/.test(await A.text("[data-episodes-aside]")) && /Drops \w{3} 9:00 PM/.test(await A.text("[data-ep-to-air='drop']")) && (await pg.locator("[data-ep-up]").count()) === 0 && !/Nothing has aired/.test(await pg.locator("main").textContent()), "Coming Soon's Episodes: the drop as one line");
      await A.shot("soon-episodes");
      await A.wide("Coming Soon's Episodes");

      // ＋ on the rail: Fresh Drop becomes his, and he stays on the hub.
      await A.hub();
      await rail.scrollIntoViewIfNeeded();
      await chip(S.fresh).scrollIntoViewIfNeeded();
      await chip(S.fresh).locator("[data-rail-add]").click();
      const where = pg.locator("[role=dialog][data-open]");
      await where.locator("[data-where-save]").waitFor({ timeout: 15_000 });
      await A.shot("add-where");
      await where.locator("[data-where-save]").click();
      await where.waitFor({ state: "hidden" }).catch(() => {});
      await pg.waitForFunction((id) => document.querySelector(`[data-rail] .overflow-x-auto [data-rail-chip="${id}"]`)?.hasAttribute("data-rail-yours"), S.fresh, { timeout: 15_000 }).catch(() => {});
      const followRow = (await pool.query("SELECT following, private, seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.alex, S.fresh])).rows[0];
      check(followRow?.following === true && followRow.private === false && new URL(pg.url()).pathname === "/home", "the ＋: where you are, then it's his (openly), still on the hub", JSON.stringify(followRow));
      check((await chip(S.fresh).getAttribute("data-rail-yours")) === "true" && (await chip(S.fresh).locator("[data-rail-add]").count()) === 0 && (await tagOf(S.fresh))[0] === "new", "its chip: his now (no ＋), still a new drop");
      await A.shot("added");
      // A chip opens its show.
      await chip(S.severed).locator("a").click();
      await pg.waitForURL(`**/show/${S.severed}/tonight`, { timeout: 15_000 });
      check(true, "a chip opens its show");

      // The drop arrives: Coming Soon minutes after it.
      await pool.query(`UPDATE show_seasons SET drop_at = now() - interval '5 minutes', premiere_date = current_date, status = 'completed' WHERE id = $1`, [S.soon]);
      await A.tonight(S.soon, "[data-phase]");
      check(/Episode 1/i.test(await A.text("[data-phase]")) && /Your own pace/.test(await A.text("[data-phase]")) && /All 8 episodes · HBO Max/.test(await A.status()) && (await pg.locator("[data-drop-plate]").count()) === 0, "five minutes after the drop: Episode 1 at your own pace, all 8 out");
      check(!/On air/i.test(await pg.locator("body").textContent()), "and nothing says On air");
      await A.shot("soon-dropped");
      await A.hub();
      await rail.scrollIntoViewIfNeeded();
      check((await tagOf(S.soon))[0] === "new" && (await chip(S.soon).getAttribute("data-rail-rank")) === "1", "the rail: Coming Soon is a new drop now");
      check(A.errors().length === 0, "no page errors (alex)", A.errors().join(" | "));

      // ---------- sam: his private one ----------
      const M = await browse(fixture.username("sam"), PASSWORD, "sam");
      await M.hub();
      const mRail = M.pg.locator("[data-rail]");
      await mRail.waitFor({ timeout: 30_000 });
      const mOrder = await mRail.locator(".overflow-x-auto [data-rail-chip]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-chip")));
      check(mOrder.includes(S.secret) && mOrder.includes(S.fresh), "sam's rail: his private Secret Stream and Fresh Drop", mOrder.join());
      await mRail.scrollIntoViewIfNeeded();
      await M.shot("rail");
      check(M.errors().length === 0, "no page errors (sam)", M.errors().join(" | "));

      // ---------- casey: alex's other couch ----------
      const C = await browse(fixture.username("casey"), PASSWORD, "casey");
      await C.hub();
      const cRail = C.pg.locator("[data-rail]");
      await cRail.waitFor({ timeout: 30_000 });
      const cOrder = await cRail.locator(".overflow-x-auto [data-rail-chip]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-rail-chip")));
      check(cOrder.includes(S.severed) && !cOrder.includes(S.wire) && !cOrder.includes(S.secret), "casey's rail: what alex streams, not jordan's Old Wire", cOrder.join());
      check(C.errors().length === 0, "no page errors (casey)", C.errors().join(" | "));

      // ---------- the solo hub ----------
      await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, following, private) VALUES ($1, $2, 2, true, false)`, [so.users.alex, S.severed]);
      const O = await browse(soloFixture.username("alex"), soloFixture.PASSWORD, "solo");
      await O.pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await O.pg.locator("[data-solo-hub]").waitFor({ timeout: 30_000 });
      const oRail = O.pg.locator("[data-rail]");
      await oRail.waitFor({ timeout: 30_000 });
      await oRail.scrollIntoViewIfNeeded();
      await O.pg.waitForTimeout(500);
      check(/^Streaming$/i.test(await O.text("[data-rail] h2")) && (await oRail.locator(".overflow-x-auto [data-rail-chip]").count()) === 1, "the solo hub: Streaming, his one show", await O.text("[data-rail] h2"));
      check(/Continue · Ep 3/i.test(await O.text("[data-rail] [data-rail-tag]")) && /Just you so far/.test(await O.text("[data-rail] [data-rail-who]")), "Continue · Ep 3, just him");
      await O.pg.evaluate(() => window.scrollBy(0, -120));
      await O.shot("solo-rail");
      check(O.errors().length === 0, "no page errors (solo)", O.errors().join(" | "));
    }
    await pool.query("DELETE FROM watch_sessions WHERE id = $1", [ws]).catch(() => {});
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await soloFixture.down(pool).catch((e) => console.error(e));
      await streamingFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
