// Dev-only check for watching (docs/PLAN-new-design.md step 10 part 1), against the dev server, on new-fixture.js's couch
// ("ZT Survivor 51": alex, riley, jordan and sam play its three games; riley follows ZT Traitors 5 openly, jordan privately)
// and a stand-in for TVmaze (fake-listings.js: "ZT Love Shack" in the US and the UK, "ZT Traitors", a streaming drop, an
// ended talk show), reached through the dev server's `x-gys-listings` header.
//   API:
//   - the listings proxy: search (kind, network, country, year), one listing's season (on now, else next, else latest; how
//     much has aired), a short query, the listings down (unavailable, still answering);
//   - Add a show: a show made from its listing (not a game yet, its art, kind and terms, its season and every episode's air
//     time as 'listing' rows, a special left out, where you are capped at what's aired), made once for everyone, the UK
//     show with the same name kept apart, a show already here matched by name and linked (its own schedule untouched), a
//     streaming drop, an ended show's latest season, by name (made once; a name already here followed), what's refused
//     (no show, a bad listing, the listings down for a new show; a known one still follows), ten new shows a day, a day-old
//     listing season read again (never over research's own row);
//   - the catalog has every show now (not only the curated ones), first run's wall only the curated; follows: the nudge's
//     Not now (only on a show you follow), where you are on a season you play refused; first run saves a listing and a
//     name (a waiting account only the listing);
//   - the home's couch shows (what the couch watches that you don't; never a private follow) and the space's you.plays.
//   In a real browser at --width (390 by default), as alex: The couch is watching (not on your list first; Add to my shows
//   asks where you are and stays on the hub), the "you both watch" nudge (the most people first, Not now, then the next),
//   Add a show (suggestions, the listings as you type, a listing's where you are, Add as a new show, already on your list),
//   a show with no game (Not a game yet, the spoiler chip, Who's watching without anyone private, Make it a game's
//   plate (check-new-make-it.js takes it from there), the ⋯ menu's Watch privately, Where you are and Remove from my shows), a show you don't follow (who watches
//   it, Add to my shows); then a newcomer's first run picking a listing and a name. Nothing wider than the screen; no page
//   errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-watching.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it; its down also removes the shows
// zt_nd people added); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-watching runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-watching.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const rid = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

/** A zt_nd_ person on no couch (new-fixture's down removes them with the rest). `approved` false: waiting to get in. */
async function newcomer(pool, who, approved = true) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = rid();
  const name = `zt_nd_${who}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, now(), now())`,
    [id, name, `${name}@example.invalid`, approved]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    rid(),
    id,
    await hashPassword(PASSWORD),
  ]);
  await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
  return id;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  const headers = { "x-gys-listings": tv.url };
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD, headers });
    const anon = (url) => fetch(BASE + url, { headers }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));
    const showOf = async (tvId) => (await pool.query("SELECT * FROM shows WHERE tvmaze_id = $1", [tvId])).rows[0];
    const follow = async (userId, seasonId) => (await pool.query("SELECT * FROM show_follows WHERE user_id = $1 AND season_id = $2", [userId, seasonId])).rows[0];

    // ---- the listings proxy ----
    const s1 = await anon("/api/listings/search?q=zt%20love");
    const hits = s1.body?.hits ?? [];
    check(s1.status === 200 && hits.length === 2 && hits.every((h) => h.name === "ZT Love Shack"), "search: both shows called ZT Love Shack", JSON.stringify(s1.body).slice(0, 200));
    const us = hits.find((h) => h.tvmazeId === 990001);
    const uk = hits.find((h) => h.tvmazeId === 990003);
    check(us?.country === "US" && us.network === "ZT Network" && us.kind === "competition" && us.running && /love-island/.test(us.thumb ?? ""), "the US one: its streaming service's country, reality as a competition, its poster", JSON.stringify(us));
    check(uk?.country === "GB" && uk.network === "ZT Two" && uk.year === 2015 && uk.running === false, "the UK one told apart: its network, country, year, ended", JSON.stringify(uk));
    check(/s-maxage=3600/.test(s1.headers.get("cache-control") ?? ""), "the edge keeps a search for an hour", s1.headers.get("cache-control"));
    check(((await anon("/api/listings/search?q=z")).body?.hits ?? [1]).length === 0, "a one-letter search asks nothing");
    const l1 = (await anon("/api/listings/990001")).body;
    check(l1?.season?.number === 1 && l1.season.aired === 3 && l1.season.status === "airing" && l1.season.episodeCount === 8, "one listing: its season on now (not the undated one), three aired of eight", JSON.stringify(l1?.season));
    const l5 = (await anon("/api/listings/990005")).body;
    check(l5?.season?.number === 2 && l5.season.status === "completed" && l5.season.aired === 6, "an ended show: its latest season, every episode aired", JSON.stringify(l5?.season));
    check((await anon("/api/listings/999999")).status === 404, "a listing that isn't there: 404");
    tv.down = true;
    const down = await anon("/api/listings/search?q=zt%20drop");
    check(down.status === 200 && down.body?.unavailable === true && down.body.hits.length === 0 && /s-maxage=60\b/.test(down.headers.get("cache-control") ?? ""), "the listings down: still answers, unavailable, kept a minute", JSON.stringify(down.body));
    tv.down = false;

    // ---- the home before: what the couch watches that alex doesn't ----
    const h0 = (await as.alex.call("GET", "/api/me/home")).body;
    const couchShows0 = (h0.couchShows ?? []).map((s) => s.seasonId);
    check(couchShows0.includes(tsid) && !couchShows0.includes(sid), "alex's couch shows: ZT Traitors (riley watches it openly), not what he plays", JSON.stringify(couchShows0));
    check(h0.couchShows.find((s) => s.seasonId === tsid)?.ready === true && "upNext" in h0.couchShows[0], "each with whether it's a game and what's next");
    const rh0 = (await as.riley.call("GET", "/api/me/home")).body;
    check(!(rh0.couchShows ?? []).some((s) => s.seasonId === tsid), "riley follows the Traitors herself, so it's hers, not the couch's");

    // ---- Add a show from its listing ----
    const a1 = await as.alex.call("POST", "/api/me/shows", { listing: 990001, seenThrough: 9 });
    check(a1.status === 200 && a1.body.made === true && a1.body.ready === false && a1.body.aired === 3 && a1.body.seenThrough === 3 && a1.body.label === "ZT Love Shack 1", "alex adds ZT Love Shack: made, not a game yet, where he is capped at the 3 aired", JSON.stringify(a1.body));
    const shack = await showOf(990001);
    check(shack?.set_up_at === null && shack.kind === "competition" && shack.created_by === fx.users.alex && shack.castaway_term === "Contestant" && /love-island/.test(shack.art_url ?? ""), "the show: not set up, a competition, alex's, its poster", JSON.stringify({ ...shack, listing: undefined }));
    check(shack?.listing?.network === "ZT Network" && !!shack.listing.fetchedAt && shack.slug === "zt-love-shack", "its listing kept (network, when it was read), a slug from its name", JSON.stringify(shack?.listing));
    const shackSeason = (await pool.query("SELECT * FROM show_seasons WHERE show_id = $1", [shack.id])).rows;
    const ss = shackSeason[0];
    check(shackSeason.length === 1 && ss.id === a1.body.seasonId && ss.season_number === 1 && ss.status === "airing" && ss.episode_count === 8 && ss.listing_id === 9900011, "one season, the one on now, eight episodes", JSON.stringify(ss));
    check(ss.air_tz === "America/New_York" && String(ss.air_time).startsWith("21:00") && ss.release === "weekly", "airing weekly at 9 PM Eastern (its service's country)", `${ss.air_tz} ${ss.air_time} ${ss.release}`);
    const eps = (await pool.query("SELECT number, air_at, runtime_min, title, source FROM season_episodes WHERE season_id = $1 ORDER BY number", [ss.id])).rows;
    check(eps.length === 8 && eps.every((e) => e.source === "listing" && e.runtime_min === 60 && e.air_at) && eps[0].title === "Night 1", "every episode's air time as a 'listing' row; the special left out", `${eps.length}`);
    const f1 = await follow(fx.users.alex, ss.id);
    check(f1?.following === true && f1.private === false && f1.seen_through === 3, "alex follows it openly, through Episode 3", JSON.stringify(f1));
    const a2 = await as.riley.call("POST", "/api/me/shows", { listing: 990001 });
    check(a2.status === 200 && a2.body.made === false && a2.body.seasonId === ss.id && a2.body.seenThrough === 0, "riley adds it too: the same show and season, not made twice", JSON.stringify(a2.body));
    check((await pool.query("SELECT count(*)::int AS n FROM shows WHERE tvmaze_id = 990001")).rows[0].n === 1, "one show for its listing");
    const a3 = await as.jordan.call("POST", "/api/me/shows", { listing: 990003 });
    const ukShow = await showOf(990003);
    const ukSeason = (await pool.query("SELECT * FROM show_seasons WHERE show_id = $1", [ukShow?.id])).rows[0];
    check(a3.body.made === true && ukShow.id !== shack.id && ukShow.slug === "zt-love-shack-2" && ukSeason.air_tz === "Europe/London" && ukSeason.status === "completed", "jordan adds the UK one: a show of its own (its own slug, London time, finished)", JSON.stringify({ slug: ukShow?.slug, tz: ukSeason?.air_tz, status: ukSeason?.status }));

    // A show already here, matched by name: linked, its own season followed, its schedule left alone.
    const traitorsBefore = (await pool.query("SELECT premiere_date::text, air_time::text, listing_id FROM show_seasons WHERE id = $1", [tsid])).rows[0];
    const a4 = await as.sam.call("POST", "/api/me/shows", { listing: 990002, seenThrough: 1 });
    const linked = (await pool.query("SELECT tvmaze_id, name, created_by, art_url FROM shows WHERE slug = 'zt-nd-traitors'")).rows[0];
    const traitorsAfter = (await pool.query("SELECT premiere_date::text, air_time::text, listing_id FROM show_seasons WHERE id = $1", [tsid])).rows[0];
    const traitorsListed = (await pool.query("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1 AND source = 'listing'", [tsid])).rows[0].n;
    check(a4.status === 200 && a4.body.made === false && a4.body.seasonId === tsid, "sam adds ZT Traitors from the listings: the show already here, its Season 5", JSON.stringify(a4.body));
    check(linked.tvmaze_id === 990002 && linked.name === "ZT Traitors" && /traitors\.jpg/.test(linked.art_url), "linked to its listing; its name and art kept", JSON.stringify(linked));
    check(JSON.stringify(traitorsBefore) === JSON.stringify(traitorsAfter) && traitorsListed === 0, "its season's schedule untouched (no listing rows over it)", `${JSON.stringify(traitorsAfter)} ${traitorsListed}`);
    check((await follow(fx.users.sam, tsid))?.seen_through === 1, "sam follows it, through Episode 1");

    // A streaming drop; an ended talk show; a show by name.
    const a5 = await as.sam.call("POST", "/api/me/shows", { listing: 990004 });
    const drop = await showOf(990004);
    const dropSeason = (await pool.query("SELECT release, drop_at FROM show_seasons WHERE show_id = $1", [drop?.id])).rows[0];
    check(a5.status === 200 && drop.kind === "series" && drop.castaway_term === "Cast member" && dropSeason.release === "binge" && !!dropSeason.drop_at, "a streaming drop: a series, every episode at once", JSON.stringify(dropSeason));
    const a6 = await as.casey.call("POST", "/api/me/shows", { listing: 990005, seenThrough: 4 });
    const oldShow = await showOf(990005);
    check(a6.status === 200 && a6.body.label === "ZT Old Show 2" && a6.body.seenThrough === 4 && oldShow.kind === "talk", "an ended talk show: its latest season", JSON.stringify(a6.body));
    const n1 = await as.alex.call("POST", "/api/me/shows", { name: "  ZT Typed   Show " });
    const typed = (await pool.query("SELECT s.*, ss.season_number, ss.status FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.name = 'ZT Typed Show'")).rows;
    check(n1.status === 200 && n1.body.made === true && typed.length === 1 && typed[0].tvmaze_id === null && typed[0].set_up_at === null && typed[0].season_number === 1 && typed[0].status === "upcoming", "by name: a show of that name, a first season with nothing known yet", JSON.stringify(n1.body));
    const n2 = await as.riley.call("POST", "/api/me/shows", { name: "zt typed show" });
    check(n2.body.made === false && n2.body.seasonId === n1.body.seasonId, "the same name again: followed, not made twice");
    const n3 = await as.alex.call("POST", "/api/me/shows", { name: "ZT Survivor", seenThrough: 1 });
    check(n3.status === 200 && n3.body.made === false && n3.body.seasonId === sid && (await follow(fx.users.alex, sid))?.seen_through === 5, "a name already here (a show alex plays): followed, where he is left to his games", JSON.stringify(n3.body));

    // What's refused.
    check((await as.alex.call("POST", "/api/me/shows", {})).status === 400, "nothing to add: 400");
    check((await as.alex.call("POST", "/api/me/shows", { listing: "abc" })).status === 400, "a listing that isn't an id: 400");
    check((await as.alex.call("POST", "/api/me/shows", { name: "x" })).status === 400, "a one-letter name: 400");
    check((await as.alex.call("POST", "/api/me/shows", { listing: 999999 })).status === 404, "a listing that isn't there: 404");
    tv.down = true;
    const d1 = await as.casey.call("POST", "/api/me/shows", { listing: 990001 });
    check(d1.status === 200 && d1.body.seasonId === ss.id, "the listings down: a show already here is still followed", JSON.stringify(d1.body));
    const d2 = await as.casey.call("POST", "/api/me/shows", { listing: 990099 });
    check(d2.status === 503, "the listings down: a new show waits (503)", JSON.stringify(d2.body));
    tv.down = false;
    for (let i = 0; i < 10; i++) await pool.query(`INSERT INTO shows (slug, name, created_by) VALUES ($1, $2, $3)`, [`zt-cap-${i}`, `ZT Cap ${i}`, fx.users.casey]);
    const cap = await as.casey.call("POST", "/api/me/shows", { name: "ZT One Too Many" });
    check(cap.status === 429, "ten new shows today: the eleventh waits (429)", JSON.stringify(cap.body));
    await pool.query(`DELETE FROM shows WHERE slug LIKE 'zt-cap-%'`);

    // A day-old listing season is read again on the next add; never over research's own row.
    const ep4 = tv.shows[0].seasons[1].episodes[3];
    const moved = new Date(Date.parse(ep4.airstamp) + 3600_000).toISOString();
    ep4.airstamp = moved;
    tv.shows[0].seasons[1].episodes[4].airstamp = new Date(Date.parse(tv.shows[0].seasons[1].episodes[4].airstamp) + 3600_000).toISOString();
    await pool.query("UPDATE season_episodes SET reported_in = 4, air_at = air_at + interval '2 hours' WHERE season_id = $1 AND number = 5", [ss.id]);
    const ep5Research = (await pool.query("SELECT air_at FROM season_episodes WHERE season_id = $1 AND number = 5", [ss.id])).rows[0].air_at.toISOString();
    await as.casey.call("POST", "/api/me/shows", { listing: 990001 });
    const fresh1 = (await pool.query("SELECT air_at FROM season_episodes WHERE season_id = $1 AND number = 4", [ss.id])).rows[0].air_at.toISOString();
    check(fresh1 !== moved, "read an hour ago: not read again", fresh1);
    await pool.query("UPDATE show_seasons SET listing_fetched_at = now() - interval '2 days' WHERE id = $1", [ss.id]);
    await as.casey.call("POST", "/api/me/shows", { listing: 990001 });
    const fresh2 = (await pool.query("SELECT air_at FROM season_episodes WHERE season_id = $1 AND number IN (4, 5) ORDER BY number", [ss.id])).rows.map((r) => r.air_at.toISOString());
    check(fresh2[0] === moved && fresh2[1] === ep5Research, "two days old: read again (Episode 4 moved), research's Episode 5 kept", JSON.stringify(fresh2));

    // ---- the catalog, follows, the space ----
    const cat = (await anon("/api/catalog")).body.seasons;
    const shackRow = cat.find((s) => s.seasonId === ss.id);
    check(shackRow?.ready === false && shackRow.curated === false && shackRow.wall === false && shackRow.tvmazeId === 990001 && shackRow.network === "ZT Network", "the catalog has every show now (ZT Love Shack: not a game yet, not on first run's wall)", JSON.stringify(shackRow));
    check(cat.filter((s) => s.wall).every((s) => s.curated && s.ready), "first run's wall: only curated shows set up as games");
    check((await as.alex.call("PUT", `/api/me/follows/${tsid}`, { nudgeOff: true })).status === 404, "Not now on a show you don't follow: nothing (404), never a follow");
    check(!(await follow(fx.users.alex, tsid)), "alex still doesn't follow the Traitors");
    const nn = await as.alex.call("PUT", `/api/me/follows/${ss.id}`, { nudgeOff: true });
    const nf = await follow(fx.users.alex, ss.id);
    check(nn.status === 200 && !!nf.nudge_off_at && nf.following && nf.seen_through === 3, "Not now on a show you follow: remembered, the follow as it was", JSON.stringify(nf));
    const h1 = (await as.alex.call("GET", "/api/me/home")).body;
    check(h1.shows.find((s) => s.seasonId === ss.id)?.nudgeOff === true && h1.shows.find((s) => s.seasonId === sid)?.nudgeOff === false, "the home says which nudge was answered");
    await pool.query("UPDATE show_follows SET nudge_off_at = NULL WHERE user_id = $1 AND season_id = $2", [fx.users.alex, ss.id]);
    check((await as.alex.call("PUT", `/api/me/follows/${sid}`, { seenThrough: 2 })).status === 409, "where you are on a season you play: refused (409)");
    const sp1 = (await as.alex.call("GET", `/api/seasons/${sid}/space?couch=${fx.couchId}`)).body;
    const sp2 = (await as.alex.call("GET", `/api/seasons/${tsid}/space?couch=${fx.couchId}`)).body;
    check(sp1.you.plays === true && sp2.you.plays === false && sp2.you.following === false && sp2.ready === true && sp1.release === "weekly", "the space: plays (Survivor), not on the Traitors; ready and release in the header", JSON.stringify(sp2.you));
    const watch2 = Object.fromEntries((sp2.people ?? []).map((p) => [p.name, p.watching]));
    check(watch2.zt_nd_riley === true && watch2.zt_nd_sam === true && watch2.zt_nd_jordan === false && watch2.zt_nd_alex === false, "who watches the Traitors: riley and sam, not jordan (private)", JSON.stringify(watch2));
    const sp3 = (await as.alex.call("GET", `/api/seasons/${ss.id}/space?couch=${fx.couchId}`)).body;
    check(sp3.ready === false && sp3.you.following === true && sp3.schedule?.latestAired === 3 && sp3.schedule.episodes.length === 8, "ZT Love Shack's space: not a game yet, its eight episodes from the listing", JSON.stringify(sp3.schedule?.latestAired));
    const titles = sp3.schedule.episodes.map((e) => e.title);
    check(titles.slice(0, 3).join() === "Night 1,Night 2,Night 3" && titles.slice(3).every((t) => t === null) && sp3.schedule.upNext?.title === null, "titles only for what he's seen (Episodes 1-3); none past it, Up next's included", titles.join());
    const h2 = (await as.alex.call("GET", "/api/me/home")).body;
    check(h2.shows.find((s) => s.seasonId === ss.id)?.upNext?.title === null && (h2.couchShows ?? []).every((s) => !s.upNext?.title), "the home sends no unseen episode's title either");

    // ---- first run: a listing and a name, saved once there's an account ----
    const louId = await newcomer(pool, "wa_lou");
    const lou = await api({ user: "zt_nd_wa_lou", pass: PASSWORD, headers });
    const fr = await lou.call("POST", "/api/me/first-run", { follows: [{ listing: 990001, seenThrough: 2 }, { name: "ZT Lou's Own Show", seenThrough: 0 }] });
    const louOwn = (await pool.query("SELECT ss.id FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.name = $1", ["ZT Lou's Own Show"])).rows[0];
    check(fr.status === 200 && fr.body.saved === 2 && (await follow(louId, ss.id))?.seen_through === 2 && !!louOwn && !!(await follow(louId, louOwn.id)), "first run saves a listing (through Episode 2) and a name", JSON.stringify(fr.body));
    const waitId = await newcomer(pool, "wa_wait", false);
    const wait = await api({ user: "zt_nd_wa_wait", pass: PASSWORD, headers });
    const fw = await wait.call("POST", "/api/me/first-run", { follows: [{ listing: 990001, seenThrough: 1 }, { name: "ZT Waiting Room Show", seenThrough: 0 }] });
    const waitNamed = (await pool.query("SELECT 1 FROM shows WHERE name = 'ZT Waiting Room Show'")).rows.length;
    check(fw.status === 200 && fw.body.saved === 1 && !!(await follow(waitId, ss.id)) && !waitNamed, "an account still waiting to get in: the listing, but nothing by name", JSON.stringify(fw.body));
    check((await wait.call("POST", "/api/me/shows", { listing: 990001 })).status === 403, "and no Add a show until it's let in (403)");

    if (!apiOnly) {
      await newcomer(pool, "wa_kim");
      const hideBadge = (ctx) =>
        ctx.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => {
            const s = document.createElement("style");
            s.textContent = "nextjs-portal{display:none!important}";
            document.head.appendChild(s);
          });
        });
      const session = async (user) => {
        const b = await open({ user, pass: PASSWORD, width, motion: "off", headers });
        await hideBadge(b.page.context());
        return b;
      };
      let n = 0;
      const shot = async (name, p) => {
        await p.waitForTimeout(450);
        await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where, p) => {
        const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
      };
      const toasted = async (re, p) => {
        try {
          await p.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
        } catch {
          /* the text says what came instead */
        }
        return ((await p.locator("[role=status]").textContent().catch(() => "")) || "").trim();
      };
      const sheet = (p) => p.locator("[role=dialog][data-open]");
      const sheetGone = (p) => p.locator("[role=dialog][data-open]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      const scrollTo = (p, sel) => p.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "center" }));

      // ---- alex: The couch is watching, the nudge ----
      const A = await session("zt_nd_alex");
      close = A.close;
      const page = A.page;
      await page.goto(`${BASE}/home?hub=focus`);
      await page.locator("[data-couch-watching]").waitFor({ timeout: 30_000 });
      const cards = await page.locator("[data-couch-watching] [data-watched]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-watched")}${e.querySelector("[data-watch-add]") ? "+" : ""}`));
      check(
        cards[0] === "ZT Traitors 5+" && cards.includes("ZT Love Shack 1") && !cards.includes("ZT Survivor 51") && !cards.some((c) => /Drop Show/.test(c)),
        "The couch is watching: the Traitors first (not on his list), then his own; not the couch's game (Your shows has it), nor the streaming drop (the rail's)",
        cards.join()
      );
      check(/zt_nd_riley/.test(await page.locator('[data-watched="ZT Traitors 5"]').innerText()) && !/zt_nd_jordan/.test(await page.locator('[data-watched="ZT Traitors 5"]').innerText()), "who watches it: riley and sam, never jordan's private follow");
      await scrollTo(page, "[data-couch-watching]");
      await fits("the hub", page);
      await shot("couch-watching", page);
      await page.locator('[data-watch-add="ZT Traitors 5"]').click();
      await sheet(page).locator("[data-where-ask]").waitFor();
      check(/Haven't started/.test(await sheet(page).locator("[data-where-line]").innerText()), "Add to my shows asks where you are, from Haven't started");
      await sheet(page).getByRole("button", { name: "Later in ZT Traitors 5" }).click();
      await sheet(page).getByRole("button", { name: "Later in ZT Traitors 5" }).click();
      await shot("where-sheet", page);
      await sheet(page).locator("[data-where-save]").click();
      check(/ZT Traitors 5 added to your shows/.test(await toasted(/added to your shows/, page)), "added, with a toast", await toasted(/added/, page));
      await sheetGone(page);
      check(new URL(page.url()).pathname === "/home", "and it stays on the hub");
      check((await follow(fx.users.alex, tsid))?.seen_through === 2, "followed through Episode 2");
      await page.locator('[data-watched="ZT Traitors 5"]:not(:has([data-watch-add]))').waitFor({ timeout: 10000 }).catch(() => {});
      check((await page.locator('[data-watched="ZT Traitors 5"] [data-watch-add]').count()) === 0, "its card is his now");

      const nudge = page.locator("[data-nudge]");
      await nudge.waitFor({ timeout: 10000 });
      const nudge1 = await nudge.innerText();
      check((await nudge.getAttribute("data-nudge")) === tsid && /You, zt_nd_(riley|sam) and zt_nd_(riley|sam) all watch ZT Traitors/.test(nudge1) && /Start a game/.test(nudge1), "the nudge: the Traitors first (riley and sam watch it too)", nudge1.replace(/\n/g, " | "));
      await scrollTo(page, "[data-nudge]");
      await shot("nudge", page);
      await page.locator("[data-nudge-no]").click();
      check(/won't ask about this one again/.test(await toasted(/ask about this one/, page)), "Not now: we won't ask again");
      await page.waitForFunction((id) => document.querySelector("[data-nudge]")?.getAttribute("data-nudge") !== id, tsid, { timeout: 10000 }).catch(() => {});
      check(!!(await follow(fx.users.alex, tsid))?.nudge_off_at, "remembered");
      const nudge2 = await nudge.innerText().catch(() => "");
      check((await nudge.getAttribute("data-nudge").catch(() => null)) === ss.id && /You and zt_nd_riley both watch ZT Love Shack/.test(nudge2) && /Make it a game/.test(nudge2), "then the next: ZT Love Shack, not a game yet, so Make it a game", nudge2.replace(/\n/g, " | "));
      await page.locator("[data-nudge-go]").click();
      await page.waitForURL(`**/show/${ss.id}/games`);
      check((await page.locator('[data-play-it="make"] [data-make-it]').count()) === 1, "its button opens the show's Games tab, where Make it a game is (step 10 part 2a)");
      await shot("make-it-a-game", page);

      // ---- Add a show ----
      await page.goto(`${BASE}/home?hub=focus`);
      await page.locator("[data-add-show-poster]").waitFor({ timeout: 30_000 });
      await page.locator("[data-add-show-poster]").click();
      await sheet(page).locator("[data-add-input]").waitFor();
      const suggest = await sheet(page).locator("[data-suggest]").evaluateAll((els) => els.map((e) => e.getAttribute("data-suggest")));
      check(suggest.includes("ZT Drop Show 1") && suggest.includes("ZT Love Shack 1") && !suggest.includes("ZT Traitors 5"), "suggestions: what the couch watches that he doesn't (sam's drop, jordan's UK Love Shack), not what's his", suggest.join());
      await fits("Add a show", page);
      await shot("add-show", page);
      await sheet(page).locator("[data-add-input]").fill("zt love shack");
      await sheet(page).locator("[data-hit-kind]").first().waitFor();
      await page.waitForFunction(() => !document.querySelector("[data-search-note]"), null, { timeout: 10000 }).catch(() => {});
      const rows = await sheet(page).locator("[data-hit]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-hit")}:${e.getAttribute("data-hit-kind")}:${e.innerText.split("\n").pop()}`));
      check(rows.length === 2 && rows.every((r) => r.includes(":season:")) && rows.some((r) => /On your list/i.test(r)), "both Love Shacks are here now: his On your list, the UK one too; neither listing twice", rows.join(" | "));
      check(/ZT Two · UK/.test(await sheet(page).locator("[data-hit]").nth(1).innerText()) || /ZT Two · UK/.test(await sheet(page).locator("[data-hit]").nth(0).innerText()), "the UK one told apart by its network");
      check((await sheet(page).locator("[data-add-new]").count()) === 0, "an exact name: no Add as a new show");
      await sheet(page).locator("[data-hit*='Love Shack']").filter({ hasText: /On your list/i }).click();
      check(/already on your list/.test(await toasted(/already on your list/, page)), "his own: already on your list");
      await sheet(page).locator("[data-add-input]").fill("zt old");
      await sheet(page).locator("[data-hit-kind]").first().waitFor();
      const old = await sheet(page).locator("[data-hit]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-hit")}:${e.getAttribute("data-hit-kind")}`));
      check(old.join() === "ZT Old Show 2:season", "casey's ended talk show is here (so its listing isn't shown twice)", old.join());
      await sheet(page).locator("[data-add-input]").fill("ZT Brand Spanking");
      await sheet(page).locator("[data-add-new]").waitFor();
      check((await sheet(page).locator("[data-hit]").count()) === 0, "nothing called that, here or in the listings");
      await shot("add-new", page);
      await sheet(page).locator("[data-add-new]").click();
      await sheet(page).locator("[data-add-name]").waitFor();
      await shot("add-by-name", page);
      await sheet(page).locator("[data-add-name-go]").click();
      check(/ZT Brand Spanking 1 added to your shows · not a game yet/.test(await toasted(/Brand Spanking/, page)), "added by name: not a game yet", await toasted(/added/, page));
      await sheet(page).locator("[data-add-input]").waitFor();
      check((await sheet(page).locator("[data-add-input]").inputValue()) === "ZT Brand Spanking", "back on the search, the sheet still open");
      await page.keyboard.press("Escape");
      await sheetGone(page);
      check((await pool.query("SELECT 1 FROM shows WHERE name = 'ZT Brand Spanking' AND created_by = $1", [fx.users.alex])).rows.length === 1, "made, alex's");
      // A listing from the search: Add a show asks where you are from the listing.
      tv.shows.push({ show: { ...tv.shows[0].show, id: 990006, name: "ZT Late Bloomer", image: null, url: "https://www.tvmaze.com/shows/990006" }, seasons: tv.shows[0].seasons });
      await page.locator("[data-add-show-poster]").click();
      await sheet(page).locator("[data-add-input]").fill("zt late bloom");
      await sheet(page).locator("[data-hit='ZT Late Bloomer']").waitFor({ timeout: 15000 });
      check(/Not a game yet/i.test(await sheet(page).locator("[data-hit='ZT Late Bloomer']").innerText()), "a listing that isn't here: Not a game yet");
      await shot("listing-row", page);
      await sheet(page).locator("[data-hit='ZT Late Bloomer']").click();
      await sheet(page).locator("[data-where-ask]").waitFor();
      check(/Haven't started/.test(await sheet(page).locator("[data-where-line]").innerText()) && (await sheet(page).locator("[data-stepper]").count()) === 1, "where you are, from the listing (three aired)");
      for (let i = 0; i < 3; i++) await sheet(page).getByRole("button", { name: /^Later in/ }).click();
      check(
        /Caught up through Episode 3/.test(await sheet(page).locator("[data-where-line]").innerText()) && (await sheet(page).getByRole("button", { name: /^Later in/ }).isDisabled()),
        "never past what's aired",
        await sheet(page).locator("[data-where-line]").innerText()
      );
      await sheet(page).locator("[data-where-save]").click();
      check(/ZT Late Bloomer 1 added to your shows · not a game yet/.test(await toasted(/Late Bloomer/, page)), "added from the listing", await toasted(/added/, page));
      await page.keyboard.press("Escape");
      await sheetGone(page);
      const bloom = await showOf(990006);
      const bloomSeason = bloom ? (await pool.query("SELECT id FROM show_seasons WHERE show_id = $1", [bloom.id])).rows[0] : null;
      check(!!bloomSeason && (await follow(fx.users.alex, bloomSeason.id))?.seen_through === 3, "made, followed through Episode 3");
      const posters = await page.locator("[data-add-show-poster]").evaluate((el) => [...el.parentElement.children].length);
      check(posters >= 6, "his shelf has the new shows", `${posters}`);

      // ---- a show with no game ----
      await page.goto(`${BASE}/show/${ss.id}/tonight`);
      await page.locator("[data-following]").waitFor({ timeout: 30_000 });
      // The couch line and Who's watching fill in once the space's read (who's on the couch) is back.
      await page.waitForFunction(() => /on the couch watch/.test(document.querySelector("[data-couch-line]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
      await page.locator("[data-whos-watching] [data-watcher]").nth(1).waitFor({ timeout: 15000 }).catch(() => {});
      const line = await page.locator("[data-couch-line]").innerText();
      check(/2 on the couch watch/.test(line) && /Not a game yet/i.test(line), "the couch line: who watches it, Not a game yet", line);
      check(/you're on Ep 3/.test(await page.locator("[data-following]").innerText()), "the spoiler chip: he's on Episode 3");
      const watchers = await page.locator("[data-whos-watching] [data-watcher]").evaluateAll((els) => els.map((e) => e.getAttribute("data-watcher")));
      check(watchers.join() === "zt_nd_alex,zt_nd_riley", "Who's watching: him, then riley (never how far)", watchers.join());
      check((await page.locator('[data-play-it="make"] [data-make-it]').count()) === 1, "Make it a game (real since step 10 part 2a)");
      await fits("a show with no game", page);
      await shot("no-game-tonight", page);
      await page.getByRole("button", { name: /^Show menu/ }).click();
      await sheet(page).getByText("Watch privately").waitFor();
      check((await sheet(page).getByText("How it works").count()) === 0, "no How it works for a show that isn't a game");
      await shot("menu", page);
      await sheet(page).getByText("Watch privately").click();
      check(/Watching privately/.test(await toasted(/privately/, page)), "Watch privately: on");
      await page.locator("[data-private-line]").waitFor();
      check((await follow(fx.users.alex, ss.id))?.private === true, "the follow is private");
      const rileySpace = (await as.riley.call("GET", `/api/seasons/${ss.id}/space?couch=${fx.couchId}`)).body;
      check(rileySpace.people.find((p) => p.name === "zt_nd_alex")?.watching === false, "riley no longer sees him watch it");
      await shot("private", page);
      await page.getByRole("button", { name: /^Show menu/ }).click();
      await sheet(page).getByText("Watch privately").click();
      await toasted(/can see you watch it again/, page);
      check((await follow(fx.users.alex, ss.id))?.private === false, "and off again");
      await page.getByRole("button", { name: /^Show menu/ }).click();
      await sheet(page).getByRole("button", { name: /^Where you are/ }).click();
      await sheet(page).locator("[data-where-ask]").waitFor();
      await sheet(page).getByRole("button", { name: "Earlier in ZT Love Shack 1" }).click();
      await sheet(page).getByRole("button", { name: "Earlier in ZT Love Shack 1" }).click();
      await sheet(page).locator("[data-where-save]").click();
      check(/Saved · you're on Episode 1/.test(await toasted(/Saved/, page)), "where you are, moved back to Episode 1");
      await page.waitForFunction(() => /you're on Ep 1/.test(document.querySelector("[data-following]")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
      check(/you're on Ep 1/.test(await page.locator("[data-following]").innerText()), "the chip follows");
      await page.goto(`${BASE}/show/${ss.id}/episodes`);
      await page.locator("[data-ep-aired]").first().waitFor({ timeout: 30_000 });
      const aired = await page.locator("[data-ep-aired]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-ep-aired")}:${e.getAttribute("data-watched")}`));
      check(aired.join() === "3:no,2:no,1:yes", "Episodes: every aired episode, newest first, seen (Episode 1) or not yet", aired.join());
      const t1 = await page.locator('[data-ep-aired="1"] b').innerText();
      const t3 = await page.locator('[data-ep-aired="3"] b').innerText();
      check(t1 === "Night 1" && t3 === "Episode 3", "a seen one has its listing's title; an unseen one only its number (a title can give it away)", `${t1} / ${t3}`);
      for (const tab of ["episodes", "games", "cast"]) {
        await page.goto(`${BASE}/show/${ss.id}/${tab}`);
        await page.locator(`[data-tab="${tab}"]`).waitFor({ timeout: 30_000 });
        await page.waitForTimeout(800);
        await fits(`the ${tab} tab of a show with no game`, page);
        await shot(`no-game-${tab}`, page);
      }
      await page.goto(`${BASE}/show/${ss.id}/tonight`);
      await page.locator("[data-following]").waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: /^Show menu/ }).click();
      await sheet(page).getByText("Remove from my shows").click();
      check(/removed from your shows/.test(await toasted(/removed/, page)), "Remove from my shows");
      await page.waitForURL("**/home", { timeout: 15000 }).catch(() => {});
      const fr2 = await follow(fx.users.alex, ss.id);
      check(new URL(page.url()).pathname === "/home" && fr2.following === false && fr2.seen_through === 1, "back to the hub; where he was is kept", JSON.stringify(fr2));

      // ---- a show he doesn't follow ----
      await page.goto(`${BASE}/show/${ukSeason.id}/tonight`);
      await page.locator("[data-follow-card]").waitFor({ timeout: 30_000 });
      check(/zt_nd_jordan watches this/.test(await page.locator("[data-follow-card]").innerText()), "a show he doesn't follow: who on the couch does");
      await shot("not-yours", page);
      await page.locator("[data-follow-add]").click();
      await sheet(page).locator("[data-where-ask]").waitFor();
      await sheet(page).locator("[data-where-save]").click();
      await toasted(/added to your shows/, page);
      await page.locator("[data-following]").waitFor({ timeout: 10000 });
      check((await follow(fx.users.alex, ukSeason.id))?.following === true, "Add to my shows from the show: followed, the chip in its place");
      const alexErrors = A.errors.filter((e) => !/Failed to load resource/.test(e));
      check(!alexErrors.length, "no page errors (alex)", alexErrors.join(" | "));
      await A.close();

      // ---- a newcomer's first run: a listing and a name ----
      const K = await session("zt_nd_wa_kim");
      close = K.close;
      const p = K.page;
      await p.goto(`${BASE}/start/1`);
      await p.locator("[data-search-shows]").waitFor({ timeout: 30_000 });
      await p.locator("[data-search-shows]").click();
      await sheet(p).locator("[data-search-input]").fill("zt drop");
      await sheet(p).locator("[data-hit='ZT Drop Show 1']").waitFor();
      check((await sheet(p).locator("[data-hit-kind='listing']").count()) === 0, "first run's search finds sam's drop here (every show now, not only curated)");
      await sheet(p).locator("[data-search-input]").fill("zt late");
      await sheet(p).locator("[data-hit='ZT Late Bloomer 1']").waitFor();
      tv.shows.push({ show: { ...tv.shows[0].show, id: 990007, name: "ZT Kim's Find", image: null, url: "https://www.tvmaze.com/shows/990007" }, seasons: tv.shows[0].seasons });
      await sheet(p).locator("[data-search-input]").fill("zt kim");
      await sheet(p).locator("[data-hit=\"ZT Kim's Find\"]").waitFor({ timeout: 15000 });
      await shot("first-run-search", p);
      await sheet(p).locator("[data-hit=\"ZT Kim's Find\"]").click();
      await sheetGone(p);
      await p.locator("[data-search-shows]").click();
      await sheet(p).locator("[data-search-input]").fill("ZT Nobody Lists This");
      await sheet(p).locator("[data-add-new]").waitFor();
      await sheet(p).locator("[data-add-new]").click();
      await sheetGone(p);
      const picks = await p.locator("[data-show-wall] [data-pick]").evaluateAll((els) => els.map((e) => e.getAttribute("data-pick")));
      check(picks.includes("ZT Kim's Find") && picks.includes("ZT Nobody Lists This"), "both on the wall, picked", picks.join());
      check(/2 picked/i.test(await p.locator("[data-next]").innerText()), "Next · 2 picked");
      await shot("first-run-wall", p);
      await p.locator("[data-next]").click();
      await p.waitForURL(/\/start\/2$/);
      await p.locator("[data-where=\"ZT Kim's Find 1\"]").waitFor({ timeout: 15000 });
      check(/Added by name/.test(await p.locator("[data-where='ZT Nobody Lists This'] [data-where-line]").innerText()) && (await p.locator("[data-where='ZT Nobody Lists This'] [data-stepper]").count()) === 0, "by name: no stepper, its episodes come later");
      await p.getByRole("button", { name: "Later in ZT Kim's Find 1" }).click();
      await p.getByRole("button", { name: "Later in ZT Kim's Find 1" }).click();
      await fits("first run's where you are", p);
      await shot("first-run-where", p);
      await p.locator("[data-next]").click();
      await p.waitForURL(/\/start\/4$/, { timeout: 20000 });
      const kim = (await pool.query("SELECT id FROM \"user\" WHERE username = 'zt_nd_wa_kim'")).rows[0].id;
      const kimFollows = (await pool.query("SELECT s.name, f.seen_through FROM show_follows f JOIN show_seasons ss ON ss.id = f.season_id JOIN shows s ON s.id = ss.show_id WHERE f.user_id = $1 ORDER BY s.name", [kim])).rows;
      check(JSON.stringify(kimFollows) === JSON.stringify([{ name: "ZT Kim's Find", seen_through: 2 }, { name: "ZT Nobody Lists This", seen_through: 0 }]), "saved: the listing through Episode 2 and the name, both made", JSON.stringify(kimFollows));
      const kimErrors = K.errors.filter((e) => !/Failed to load resource/.test(e));
      check(!kimErrors.length, "no page errors (first run)", kimErrors.join(" | "));
      await K.close();
      close = async () => {};
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close();
    await tv.close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
