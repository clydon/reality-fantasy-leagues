// Dev-only check for all of TV in the guide and the daily listings job (docs/PLAN-new-design.md step 11 part 2), against the
// dev server, on new-fixture.js's couch plus guide-fixture.js's shows, with the stand-in TVmaze (fake-listings.js: its own
// shows plus a week of ZT listings this check adds, ids 990100 and up) and the stand-in bot (fake-bot.js).
//   API:
//   - the job rides on the bot clock (/api/cron/bot-research): never in a call that ran a bot job (a ZT season's quick check
//     is made due for that), then a call with nothing due reads the listings after its answer (`listings: true`), once a day
//     (the next call doesn't); /api/cron/listings: the secret, its status, a run by hand, 409 while one runs, ?run=1 only when
//     due, the stand-in down (old rows kept, the run not ok);
//   - tv_listings: eight days of the evening and drops, never the news, daytime, a service abroad or another language, never
//     a title; /api/listings/week: open, kept at the edge an hour, a drop as one airing, no titles;
//   - listing seasons kept current: a changed show's season read again (research's row kept), its status moved on by date,
//     a show TVmaze didn't say changed not asked about, a listed show's next season made when announced (a set-up show's
//     with a rulebook); shows linked by name: one added by name takes the listing's season (its number, its episodes), one
//     with a schedule only gains the link.
//   In a real browser at --width (390 by default), as alex: tomorrow's Also on (the most watched three in time order, his
//   own Late Show and the couch's Traitors left out, and since step 14 part 2 a daily streaming soap, the most watched, kept in
//   tv_listings but on no day of Also on), the guide's switch (Competitions: only the listings whose blurbs say so, or set
//   up here as one; Couch: no listings; kept on the phone; All TV again), "2 more on TV" and the evening sheet (after midnight is the night
//   before's), a listing's sheet, Hide from guide with Undo, hiding from the evening sheet and Show again, Add to my shows
//   from the evening sheet (where you are, then it's his: on his guide, out of Also on), the show added by name on his guide
//   at its listing's time, a drop's day ("Streaming"), the TVmaze credit, no titles anywhere; nothing wider than the screen,
//   no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/check-new-listings.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Touches zt rows only, plus tv_listings (TV data refetched daily: any real rows are put back as
// they were) and app_settings 'listings' (put back). Refuses a non-local database, and refuses to call the bot clock when a
// real local season could have a bot job due (another season with bot research on, or an open question a tie-break run
// would ask about). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const guideFixture = require("./guide-fixture");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const G = jiti("../../src/lib/game/guide.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-listings runs against a local database only");
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-listings.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const AUTH = { authorization: `Bearer ${process.env.CRON_SECRET}` };
const DAY = 86_400_000;
// The stand-in's episode titles (fake-listings.js: "Night 3", "Part 2", oneNight's "Secret ... title 1"; the guide fixture's "Secret title 4").
const TITLES = /Secret|(?<!Same )Night \d|Part \d/;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const settingWas = (await pool.query("SELECT value FROM app_settings WHERE key = 'listings'")).rows[0]?.value ?? null;
  const realRows = (await pool.query("SELECT * FROM tv_listings WHERE tvmaze_id < 990000 OR tvmaze_id >= 1000000")).rows;
  try {
    const others = (await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on AND s.slug NOT LIKE 'zt-%'")).rows;
    if (others.length) throw new Error(`a real local season has bot research on (${others.map((r) => r.slug).join(", ")}): the clock could run its job`);
    const open0 = (await pool.query(
      `SELECT count(*)::int AS n FROM (
         SELECT season_id FROM season_decisions WHERE fact_status = 'disputed' AND locked_at IS NULL
         UNION ALL SELECT season_id FROM fact_disputes WHERE status = 'open') q
        JOIN show_seasons ss ON ss.id = q.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`
    )).rows[0].n;
    if (open0) throw new Error(`${open0} question(s) open on real local seasons: a tie-break run could ask about them`);

    const fx = await fixture.up(pool);
    const gd = await guideFixture.up(pool, fx);
    const { late } = gd.seasons;
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);

    // ---- the stand-ins: a week of ZT listings around the guide's own days (from 3 AM, in this machine's zone: the browser's) ----
    const today = G.startOfLocalDay(Date.now());
    const at = (n, h, m = 0) => {
      const d = new Date(G.addLocalDays(today, n));
      d.setHours(h, m, 0, 0); // 24:35 is the next calendar day's 00:35: still day n's night
      return d;
    };
    const N = fakeListings.oneNight;
    const art = (slug) => `/mock/showcase/art/${slug}.jpg`;
    const extra = [
      // B and D are competitions by their blurbs (the guide's Competitions); A's is a docusoap's, C has none.
      N(990100, "ZT Prime A", at(1, 20), { weight: 95, art: art("amazing-race"), summary: "<p>A family runs the busiest pawn shop in town.</p>" }),
      N(990102, "ZT Prime B", at(1, 21), { weight: 90, art: art("dwts"), summary: "<p>Celebrity couples <b>compete</b> for the mirrorball.</p>" }),
      N(990103, "ZT Prime C", at(1, 22), { weight: 85, art: art("drag-race") }),
      N(990104, "ZT Prime D", at(1, 20, 30), { weight: 40, summary: "Each week the houseguests vote someone out of the house." }),
      N(990113, "ZT After Midnight", at(1, 24, 35), { weight: 20, type: "Talk Show" }),
      N(990105, "ZT Morning", at(1, 9), { weight: 99, type: "Talk Show" }),
      N(990106, "ZT News Hour", at(1, 19), { weight: 99, type: "News" }),
      N(990101, "ZT Late Show", at(1, 23, 35), { weight: 97, type: "Talk Show" }),
      N(990111, "ZT Named Show", at(1, 19), { weight: 30, season: 4, episodeOrder: 10 }),
      N(990107, "ZT Stream Drop", at(2, 12), { web: { name: "ZT Stream", country: null }, drop: true, episodes: 3, weight: 70, type: "Scripted", art: art("pluribus") }),
      N(990108, "ZT Abroad", at(2, 12), { web: { name: "ZT Iplayer", country: "GB" }, drop: true, weight: 99, type: "Scripted" }),
      N(990109, "ZT Foreign", at(2, 12), { web: { name: "ZT Stream", country: null }, drop: true, language: "Korean", weight: 99 }),
      N(990110, "ZT Hide Me", at(2, 20), { weight: 99, art: art("big-brother") }),
      N(990112, "ZT Old Listing", Date.now() - 60 * DAY, { weight: 10 }),
      // A streaming soap (step 14 part 2): an episode every day, the most watched of all; never in Also on.
      fakeListings.daily(990114, "ZT Daily Soap", at(0, 6), 8, { weight: 99 }),
    ];
    const tv = await fakeListings.start({ shows: [...fakeListings.shows(), ...extra] });
    closers.push(tv.close);
    const bot = await fakeBot.start({ answer: () => "{}" });
    closers.push(bot.close);
    const H = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
    const as = {};
    for (const who of ["alex", "riley", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD, headers: H });
    const cron = async (method, url) => {
      const r = await fetch(BASE + url, { method, headers: { ...AUTH, ...H } });
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    const status = async () => (await cron("GET", "/api/cron/listings")).body;
    const asked = (re) => tv.asked.filter((p) => re.test(p));
    const showOf = async (tvmazeId) => (await pool.query("SELECT id, slug, name, kind, tvmaze_id, set_up_at FROM shows WHERE tvmaze_id = $1", [tvmazeId])).rows[0] ?? null;
    const seasonsOf = async (showId) =>
      (await pool.query("SELECT id, season_number, status, listing_id, episode_count FROM show_seasons WHERE show_id = $1 ORDER BY season_number", [showId])).rows;
    const episodesOf = async (seasonId) =>
      (await pool.query("SELECT number, air_at, source, reported_in FROM season_episodes WHERE season_id = $1 ORDER BY number", [seasonId])).rows;

    // ---- before the job: shows here the job will keep or link ----
    let r = await as.alex.call("POST", "/api/me/shows", { listing: 990001 }); // ZT Love Shack, made from its listing
    check(r.status === 200, "alex adds ZT Love Shack from its listing", JSON.stringify(r.body));
    const shack = await showOf(990001);
    const [shackSeason] = (await seasonsOf(shack.id)).filter((s) => s.listing_id != null);
    // (riley adds two: the fixtures' six shows already count against alex's ten new shows a day.)
    r = await as.riley.call("POST", "/api/me/shows", { listing: 990011 }); // ZT Yacht Life: TVmaze won't say it changed
    check(r.status === 200, "and ZT Yacht Life", JSON.stringify(r.body));
    r = await as.riley.call("POST", "/api/me/shows", { listing: 990112 }); // ZT Old Listing: finished; its next season comes later
    check(r.status === 200, "and ZT Old Listing (its one season finished)", JSON.stringify(r.body));
    const old = await showOf(990112);
    // Old Listing is a game (playing by the Survivor rules here): its next season should play by last season's rulebook.
    await pool.query("UPDATE shows SET set_up_at = now(), format = 'survivor' WHERE id = $1", [old.id]);
    r = await as.alex.call("POST", "/api/me/shows", { name: "ZT Named Show" }); // by name: nothing known yet
    check(r.status === 200 && r.body.made, "alex adds ZT Named Show by name", JSON.stringify(r.body));
    const named = (await pool.query("SELECT id FROM shows WHERE name = 'ZT Named Show'")).rows[0];
    const [namedSeason] = await seasonsOf(named.id);
    // The listings change after they were read: Love Shack's Episode 5 moves a day; Episode 6 moves too, but research has
    // reported on it (its row is research's now); its status is wrong by date; Old Listing's season 2 is announced.
    const shackEps = await episodesOf(shackSeason.id);
    const ep6Was = shackEps.find((e) => e.number === 6).air_at.toISOString();
    await pool.query("UPDATE season_episodes SET source = 'research' WHERE season_id = $1 AND number = 6", [shackSeason.id]);
    await pool.query("UPDATE show_seasons SET status = 'upcoming' WHERE id = $1", [shackSeason.id]);
    const shackTv = tv.shows.find((s) => s.show.id === 990001).seasons.find((x) => x.season.number === 1);
    const moved = (n, by) => {
      const e = shackTv.episodes.find((x) => x.number === n);
      e.airstamp = new Date(Date.parse(e.airstamp) + by).toISOString();
      return e.airstamp;
    };
    const ep5Now = moved(5, DAY);
    moved(6, 2 * DAY);
    const oldTv = tv.shows.find((s) => s.show.id === 990112);
    const s2 = fakeListings.oneNight(990112, "ZT Old Listing", Date.now() + 10 * DAY, { season: 2, episodes: 1, episodeOrder: 10 }).seasons[0];
    oldTv.seasons.push(s2);
    tv.updated = [990001, 990112, 990101, 990002];

    // ---- the job never rides on a call that ran a bot job ----
    await pool.query("DELETE FROM app_settings WHERE key = 'listings'");
    await pool.query("DELETE FROM tv_listings WHERE tvmaze_id >= 990000 AND tvmaze_id < 1000000");
    await pool.query(
      `UPDATE show_seasons SET air_time = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::time,
              premiere_date = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::date - 35,
              bot_research_on = true, bot_research_since = now() - interval '1 day', bot_research_schedule = $2::jsonb WHERE id = $1`,
      [sid, JSON.stringify([{ kind: "quick", after: 5, on: true }])]
    );
    check((await fetch(`${BASE}/api/cron/listings`, { headers: H })).status === 401, "the cron routes need the secret");
    check((await fetch(`${BASE}/api/cron/listings`, { method: "POST", headers: { authorization: "Bearer nope", ...H } })).status === 401, "and the right one");
    const before = tv.asked.length;
    r = await cron("POST", "/api/cron/bot-research");
    check(r.status === 200 && r.body.job?.season === "zt-nd-survivor" && r.body.listings === false, "the clock runs a bot job: no listings in that call", JSON.stringify(r.body).slice(0, 300));
    await sleep(2000);
    check(tv.asked.length === before && !(await status()).last, "nothing asked of the listings, nothing run", tv.asked.slice(before).join(","));
    await pool.query("UPDATE show_seasons SET bot_research_on = false WHERE id = $1", [sid]);

    // ---- a call with nothing due reads the listings, after its answer ----
    const t0 = Date.now();
    r = await cron("POST", "/api/cron/bot-research");
    check(r.status === 200 && r.body.job === null && r.body.listings === true, "a call with no bot job: the listings are due", JSON.stringify(r.body));
    check(Date.now() - t0 < 5000, "and it answers at once (the job runs after)", `${Date.now() - t0} ms`);
    let st = null;
    for (let i = 0; i < 60; i++) {
      st = await status();
      if (st.last?.done) break;
      await sleep(1000);
    }
    check(st.last?.done && st.last.ok === true && st.last.how === "clock" && st.last.days === 8, "the run finished: eight days, ok, by the clock", JSON.stringify(st.last));
    check(asked(/^\/schedule\?country=US&date=/).length === 8 && asked(/^\/schedule\/web\?date=/).length === 8 && asked(/^\/updates\/shows/).length === 1, "eight days of both schedules, and what changed, once", tv.asked.filter((p) => /schedule|updates/.test(p)).length);
    check(asked(/^\/updates\/shows\?since=week$/).length === 1 && !!st.last.keptAt, "the first upkeep asks for the week's changes, and says when it kept seasons current", JSON.stringify(asked(/updates/)));
    const afterRun = tv.asked.length;
    r = await cron("POST", "/api/cron/bot-research");
    check(r.body.listings === false, "the next call: already read today", JSON.stringify(r.body));
    await sleep(1500);
    check(tv.asked.length === afterRun, "nothing asked again");
    r = await cron("GET", "/api/cron/listings?run=1");
    check(r.status === 200 && r.body.ran === false, "?run=1 (a backstop cron's call): not due, nothing run", JSON.stringify(r.body).slice(0, 200));

    // ---- what's in tv_listings, and the week's read ----
    const rows = (await pool.query("SELECT name, binge, number, weight, network, country FROM tv_listings WHERE tvmaze_id >= 990000 AND tvmaze_id < 1000000")).rows;
    const has = (name) => rows.filter((x) => x.name === name);
    check(["ZT Prime A", "ZT Prime B", "ZT Prime C", "ZT Prime D", "ZT After Midnight", "ZT Late Show", "ZT Named Show", "ZT Hide Me"].every((n) => has(n).length === 1), "the evening's airings are in, after midnight too", rows.map((x) => x.name).join(","));
    check(has("ZT Stream Drop").length === 3 && has("ZT Stream Drop").every((x) => x.binge && x.network === "ZT Stream" && x.country === null), "a worldwide service's drop: its three episodes, as a drop");
    check(["ZT Morning", "ZT News Hour", "ZT Abroad", "ZT Foreign"].every((n) => !has(n).length), "never daytime, the news, a service abroad or another language");
    check(has("ZT Daily Soap").length >= 6 && has("ZT Daily Soap").every((x) => x.binge), "a daily streaming show's episodes are kept (the guide's Also on leaves them out)", String(has("ZT Daily Soap").length));
    check(has("ZT Prime A")[0]?.weight === 95, "each with its popularity");
    const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tv_listings'")).rows.map((c) => c.column_name);
    check(!cols.some((c) => /title|summary/.test(c)), "tv_listings has no title (nothing an episode's about)", cols.join(","));
    const week = await fetch(`${BASE}/api/listings/week`, { headers: H });
    const wb = await week.json();
    const weekText = JSON.stringify(wb);
    check(week.status === 200 && /public/.test(week.headers.get("cache-control") ?? "") && /s-maxage=3600/.test(week.headers.get("cache-control") ?? ""), "the week's read: open, kept at the edge an hour", week.headers.get("cache-control"));
    const dropAiring = wb.listings.filter((l) => l.name === "ZT Stream Drop");
    check(dropAiring.length === 1 && dropAiring[0].numbers.join() === "1,2,3" && dropAiring[0].binge, "a drop is one airing (episodes 1-3)", JSON.stringify(dropAiring));
    check(!TITLES.test(weekText), "no episode titles in the week's read");
    check(wb.listings.every((l) => Object.keys(l).sort().join() === "airAt,art,binge,competition,country,name,network,numbers,runtimeMin,season,tvmazeId,type,weight"), "each airing: when, what and where, nothing else", Object.keys(wb.listings[0] ?? {}).join());
    const comps = [...new Set(wb.listings.filter((l) => l.competition).map((l) => l.name))].sort();
    check(comps.join() === "ZT Prime B,ZT Prime D,ZT Traitors", "competitions: the two whose blurbs say so, and the couch's Traitors (set up here as one) though its listing has none", comps.join());
    check((await pool.query("SELECT bool_or(competition) AS c FROM tv_listings WHERE tvmaze_id = 990002")).rows[0].c === false, "(the Traitors' row says what its listing does; its kind here decides on read)");

    // ---- listing seasons kept current ----
    const shackNow = await episodesOf(shackSeason.id);
    check(shackNow.find((e) => e.number === 5).air_at.toISOString() === ep5Now, "Love Shack (TVmaze says it changed): Episode 5 moved with its listing");
    check(shackNow.find((e) => e.number === 6).air_at.toISOString() === ep6Was, "Episode 6, research's row now, kept as research had it");
    check((await seasonsOf(shack.id)).find((s) => s.id === shackSeason.id).status === "airing", "its status moved on by date (airing)");
    check(!tv.asked.slice(before).some((p) => /^\/shows\/990011\b/.test(p)), "Yacht Life (TVmaze didn't say it changed): not asked about");
    const oldSeasons = await seasonsOf(old.id);
    const made2 = oldSeasons.find((s) => s.season_number === 2);
    check(!!made2 && made2.listing_id === s2.season.id && made2.status === "upcoming" && made2.episode_count === 10, "Old Listing's season 2, announced, is made from its listing", JSON.stringify(oldSeasons));
    check(made2 && (await episodesOf(made2.id)).length === 1, "with its episode's air time");
    check(made2 && (await pool.query("SELECT 1 FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1", [made2.id])).rows.length === 1, "a game's next season plays by a rulebook (ensureSeasonRulebook)");

    // ---- shows linked by name ----
    const namedNow = await showOf(990111);
    const namedSeasons = namedNow ? await seasonsOf(namedNow.id) : [];
    check(namedNow?.id === named.id, "ZT Named Show (added by name) is linked to its listing");
    check(namedSeasons.length === 1 && namedSeasons[0].id === namedSeason.id && namedSeasons[0].season_number === 4 && namedSeasons[0].listing_id != null, "its season takes the listing's (season 4), the same row", JSON.stringify(namedSeasons));
    const namedEps = await episodesOf(namedSeason.id);
    check(namedEps.length === 1 && namedEps[0].number === 1 && namedEps[0].air_at.getTime() === at(1, 19).getTime() && namedEps[0].source === "listing", "with its episode's air time (Episode 1, tomorrow at 7 PM)", JSON.stringify(namedEps));
    const lateShow = await showOf(990101);
    check(lateShow?.slug === "zt-gd-late-show", "ZT Late Show (alex's, with a schedule) gains the link");
    check((await seasonsOf(lateShow.id)).every((s) => s.listing_id == null) && (await pool.query("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1", [late])).rows[0].n === 0, "its season untouched (no listing, no episode rows)");
    check((await showOf(990002))?.slug === "zt-nd-traitors", "the couch's ZT Traitors too");
    check((await as.alex.call("GET", "/api/me/home")).body.couchShows.find((s) => s.seasonId === tsid)?.show.tvmazeId === 990002, "so alex's home knows the couch's Traitors in the listings");

    // ---- by hand, refused while one runs, and the listings down ----
    const rowsBefore = (await pool.query("SELECT count(*)::int AS n FROM tv_listings")).rows[0].n;
    // Love Shack last changed two days ago: before the last upkeep, so the next run doesn't read it again.
    tv.changedAt[990001] = Math.floor((Date.now() - 2 * DAY) / 1000);
    const handFrom = tv.asked.length;
    r = await cron("POST", "/api/cron/listings");
    check(tv.asked.slice(handFrom).filter((x) => /^\/updates\/shows/.test(x)).join() === "/updates/shows?since=day", "a day on (or less): the day's changes", tv.asked.slice(handFrom).filter((x) => /updates/.test(x)).join());
    check(!tv.asked.slice(handFrom).some((x) => /^\/shows\/990001\b/.test(x)) && tv.asked.slice(handFrom).some((x) => /^\/shows\/990112\b/.test(x)), "a show changed before the last upkeep isn't read again; one changed since is");
    delete tv.changedAt[990001];
    check(r.status === 200 && r.body.run?.ok === true && r.body.run.how === "hand" && r.body.days.length >= 3, "a run by hand: done again, whatever ran today", JSON.stringify(r.body).slice(0, 200));
    const lastDone = (await pool.query("SELECT value FROM app_settings WHERE key = 'listings'")).rows[0].value;
    await pool.query("UPDATE app_settings SET value = value || '{\"done\": null, \"ok\": null}'::jsonb, updated_at = now() WHERE key = 'listings'");
    r = await cron("POST", "/api/cron/listings");
    check(r.status === 409, "while one runs, another is refused (409)", JSON.stringify(r.body));
    await pool.query("UPDATE app_settings SET value = $1::jsonb WHERE key = 'listings'", [JSON.stringify(lastDone)]);
    tv.down = true;
    r = await cron("POST", "/api/cron/listings");
    tv.down = false;
    check(r.status === 200 && r.body.run?.ok === false && r.body.run.failedDays.length === 8, "the listings down: the run isn't ok, eight days unanswered", JSON.stringify(r.body?.run).slice(0, 300));
    check((await pool.query("SELECT count(*)::int AS n FROM tv_listings")).rows[0].n === rowsBefore, "and the old listings are kept");
    r = await cron("POST", "/api/cron/listings");
    check(r.body.run?.ok === true, "up again: ok");

    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      let n = 0;
      const b = await open({ user: fixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off", headers: H });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      let favicon = 0;
      b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
      const pg = b.page;
      const shot = async (name) => {
        await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
        await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      };
      const wide = async (what) => {
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };
      const errorsOf = () => b.errors.filter((e) => !/Failed to load resource/.test(e)).concat(b.errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
      const toast = () => pg.locator("[role=status]").last();
      const sheet = () => pg.locator("[role=dialog][data-open]");
      const closed = () => sheet().waitFor({ state: "detached" }).catch(() => {});
      const reel = (x) => pg.evaluate((left) => (document.querySelector("[data-guide] .overflow-x-auto").scrollLeft = left), x);
      const toGuide = async () => {
        await pg.locator("[data-guide]").scrollIntoViewIfNeeded();
        await pg.evaluate(() => window.scrollBy(0, -70));
      };
      const alsoNames = (offset) => pg.locator(`[data-also-on='${offset}'] [data-listing]`).evaluateAll((xs) => xs.map((x) => x.getAttribute("aria-label").split(",")[0]));
      const listing = (id, offset = 1) => pg.locator(`[data-also-on='${offset}'] [data-tvmaze='${id}']`);

      await pg.goto(`${BASE}/home`, { waitUntil: "load" });
      await pg.locator("[data-also-on='1']").waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      check((await alsoNames(1)).join() === "ZT Prime A,ZT Prime B,ZT Prime C", "tomorrow's Also on: the three most watched, in time order", (await alsoNames(1)).join());
      check(/2 more on TV/.test(await pg.locator("[data-also-more='1']").textContent()), "and 2 more on TV");
      check(/^Also on$/i.test((await pg.locator("[data-also-on='1'] .type-caption").first().textContent()).trim()), "under alex's own shows: Also on");
      const allAlso = await pg.locator("[data-also-on] [data-listing]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-tvmaze")));
      check(!allAlso.includes("990101") && !allAlso.includes("990002"), "his Late Show and the couch's Traitors aren't in Also on", allAlso.join());
      check(!allAlso.some((x) => ["990105", "990106", "990108", "990109"].includes(x)), "nor daytime, news, abroad or another language");
      check(!allAlso.includes("990114"), "nor the daily streaming soap, on any day (step 14 part 2), though it's the most watched", allAlso.join());
      const namedCard = pg.locator(`[data-guide-card="${namedSeason.id}:1"]`);
      check((await namedCard.count()) === 1 && /7:00 PM/.test(await namedCard.textContent()), "ZT Named Show (added by name) is on his guide tomorrow at 7 PM", await namedCard.textContent().catch(() => ""));
      check(/TV listings from\s*TVmaze/.test(await pg.locator("[data-guide-credit]").textContent()), "the guide credits TVmaze");
      await toGuide();
      await reel(150);
      await shot("also-on-tomorrow");
      await wide("the hub with Also on");
      const dropDay = pg.locator("[data-also-on='2']");
      check(/Streaming/.test(await dropDay.locator("[data-tvmaze='990107']").textContent()) && /3 episodes/.test(await dropDay.locator("[data-tvmaze='990107']").textContent()), "the day after: the drop, Streaming, 3 episodes");
      check(!TITLES.test(await pg.locator("[data-guide]").innerText()), "no episode titles on the guide");

      // The guide's switch (2026-10-27): Couch · Competitions · All TV, kept on the phone.
      const tvSwitch = pg.locator("[data-guide-tv]");
      const switched = (to) => pg.waitForFunction((v) => document.querySelector("[data-guide-tv]")?.getAttribute("data-guide-tv") === v, to, { timeout: 10_000 }).catch(() => {});
      check((await tvSwitch.getAttribute("data-guide-tv")) === "all" && (await tvSwitch.locator("[aria-checked=true]").textContent()) === "All TV", "the guide's switch: All TV to begin with");
      await tvSwitch.locator("[data-guide-tv-choice='comps']").click();
      await switched("comps");
      check((await alsoNames(1)).join() === "ZT Prime D,ZT Prime B", "Competitions: tomorrow's Also on is the two competitions, in time order", (await alsoNames(1)).join());
      check((await pg.locator("[data-also-more='1']").count()) === 0 && (await pg.locator("[data-also-on='2'] [data-tvmaze='990107']").count()) === 0, "with nothing more, and the scripted drop's day without it");
      check((await namedCard.count()) === 1, "his own shows stay on the guide");
      await toGuide();
      await reel(150);
      await shot("guide-competitions");
      await tvSwitch.locator("[data-guide-tv-choice='couch']").click();
      await switched("couch");
      check((await pg.locator("[data-also-on]").count()) === 0 && (await pg.locator("[data-guide-credit]").count()) === 0 && (await namedCard.count()) === 1, "Couch: the couch's shows and his, no TV listings nor their credit");
      await pg.reload({ waitUntil: "load" });
      await pg.locator("[data-guide-tv]").waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(500);
      check((await tvSwitch.getAttribute("data-guide-tv")) === "couch" && (await pg.locator("[data-also-on]").count()) === 0, "kept on the phone: still Couch after a reload");
      await toGuide();
      await shot("guide-couch-only");
      await wide("the guide with its switch");
      await tvSwitch.locator("[data-guide-tv-choice='all']").click();
      await pg.locator("[data-also-on='1']").waitFor({ timeout: 10_000 });
      check((await alsoNames(1)).join() === "ZT Prime A,ZT Prime B,ZT Prime C", "All TV: as it was", (await alsoNames(1)).join());

      // A listing's sheet; Hide from guide with Undo.
      await listing(990100).click();
      const ls = pg.locator("[data-listing-sheet='990100']");
      await ls.waitFor();
      const lsText = await sheet().textContent();
      check(/ZT Prime A/.test(lsText) && /On TV/.test(lsText) && /8:00 PM/.test(lsText) && /Nobody on the couch watches it yet/.test(lsText), "a listing's sheet: when it's on, nobody on the couch watches it", lsText.slice(0, 200));
      await pg.waitForTimeout(400);
      await shot("listing-sheet");
      await ls.locator("[data-listing-hide]").click();
      await pg.locator("[data-guide-hidden]").waitFor();
      check(/ZT Prime A is hidden from your guide/.test(await toast().textContent()), "Hide from guide: the toast says so");
      check((await listing(990100).count()) === 0 && /1 hidden/.test(await pg.locator("[data-guide-hidden]").textContent()), "it's off the guide: 1 hidden");
      check((await alsoNames(1)).join() === "ZT Prime D,ZT Prime B,ZT Prime C", "the next most watched moves up (in time order)", (await alsoNames(1)).join());
      check((await pool.query("SELECT show_id, tvmaze_id, name FROM guide_hidden WHERE user_id = $1", [fx.users.alex])).rows.some((x) => x.tvmaze_id === 990100 && x.show_id === null), "saved as a listing");
      await toast().getByRole("button", { name: "Undo" }).click();
      await listing(990100).waitFor();
      check((await pg.locator("[data-guide-hidden]").count()) === 0, "Undo brings it back");
      await closed();

      // N more on TV: the whole evening; hide one there; add one from there.
      await pg.locator("[data-also-more='1']").click();
      const ev = pg.locator("[data-evening-sheet='1']");
      await ev.waitFor();
      const evRows = await ev.locator("[data-evening-row]").evaluateAll((xs) => xs.map((x) => x.querySelector("b").textContent));
      check(evRows.join() === "ZT Prime A,ZT Prime D,ZT Prime B,ZT Prime C,ZT After Midnight", "the evening sheet: the whole evening by time, 12:35 AM last (the night before's)", evRows.join());
      check(/Tomorrow on TV/.test(await sheet().textContent()), "titled Tomorrow on TV");
      await pg.waitForTimeout(400);
      await shot("evening-sheet");
      await ev.locator("[data-evening-row][data-tvmaze='990104'] [data-evening-hide]").click();
      await pg.waitForFunction(() => !document.querySelector("[data-evening-row][data-tvmaze='990104']"), null, { timeout: 10_000 }).catch(() => {});
      check((await ev.locator("[data-evening-row]").count()) === 4 && /ZT Prime D is hidden/.test(await toast().textContent()), "hidden from the evening sheet: its row goes");
      await ev.locator("[data-evening-row][data-tvmaze='990102'] [data-evening-add]").click();
      const where = pg.locator("[data-add-listing='990102']");
      await where.waitFor();
      await where.locator("[data-where-save]").waitFor();
      check(/Where are you in ZT Prime B/.test(await sheet().textContent()), "Add to my shows asks where you are (from its listing)");
      await pg.waitForTimeout(400);
      await shot("add-from-listing");
      await where.locator("[data-where-save]").click();
      await pg.waitForFunction(() => /ZT Prime B 1 added to your shows/.test(document.querySelector("[role=status]:last-of-type")?.textContent ?? "") || [...document.querySelectorAll("[role=status]")].some((x) => /ZT Prime B 1 added/.test(x.textContent)), null, { timeout: 15_000 }).catch(() => {});
      check([...(await pg.locator("[role=status]").allTextContents())].some((x) => /ZT Prime B 1 added to your shows · not a game yet/.test(x)), "added: ZT Prime B 1, not a game yet", (await pg.locator("[role=status]").allTextContents()).join(" | "));
      const primeB = await showOf(990102);
      const primeBSeason = primeB ? (await seasonsOf(primeB.id))[0] : null;
      check(!!primeBSeason && (await pool.query("SELECT following FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.alex, primeBSeason.id])).rows[0]?.following === true, "a show made from its listing, followed by alex");
      await closed();
      await pg.locator(`[data-guide-card="${primeBSeason.id}:1"]`).waitFor({ timeout: 15_000 }).catch(() => {});
      check((await pg.locator(`[data-guide-card="${primeBSeason.id}:1"]`).getAttribute("data-tie")) === "watches", "it's on his guide now (dashed: watched, not played)");
      check((await listing(990102).count()) === 0 && !(await alsoNames(1)).includes("ZT Prime B"), "and out of Also on", (await alsoNames(1)).join());
      await toGuide();
      await reel(150);
      await shot("added-on-guide");
      // Show again from "1 hidden" (Prime D).
      await pg.locator("[data-guide-hidden]").click();
      const hl = pg.locator("[data-guide-hidden-list]");
      await hl.waitFor();
      check((await hl.locator("[data-hidden-row]").count()) === 1 && /ZT Prime D/.test(await hl.textContent()), "the hidden sheet lists the listing");
      await hl.getByRole("button", { name: "Show again" }).click();
      await closed();
      await pg.waitForFunction(() => !document.querySelector("[data-guide-hidden]"), null, { timeout: 10_000 }).catch(() => {});
      check((await pg.locator("[data-guide-hidden]").count()) === 0 && (await alsoNames(1)).includes("ZT Prime D"), "Show again: back in Also on", (await alsoNames(1)).join());
      const bodyText = await pg.locator("body").innerText();
      check(!TITLES.test(bodyText), "no episode titles anywhere", (new RegExp(`.{0,60}(${TITLES.source}).{0,60}`).exec(bodyText) || [""])[0]);
      await wide("the hub after adding");
      check(errorsOf().length === 0, "no page errors", errorsOf().join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await pool.query("DELETE FROM tv_listings WHERE tvmaze_id >= 990000 AND tvmaze_id < 1000000").catch((e) => console.error(e));
      await guideFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    // TV data and the job's last run, put back as they were (a run here replaced the week's rows with the stand-in's).
    for (const row of realRows) {
      const cols = Object.keys(row);
      await pool
        .query(`INSERT INTO tv_listings (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (episode_id) DO NOTHING`, cols.map((c) => row[c]))
        .catch((e) => console.error(e));
    }
    if (settingWas) await pool.query("INSERT INTO app_settings (key, value) VALUES ('listings', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(settingWas)]).catch(() => {});
    else await pool.query("DELETE FROM app_settings WHERE key = 'listings'").catch(() => {});
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
