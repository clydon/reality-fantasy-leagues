// Dev-only check for Watch along (docs/PLAN-new-design.md step 13), against the dev server, on new-fixture.js's couch ("ZT Survivor
// 51": alex, riley, jordan and sam play it, results through Episode 5, everyone on 5 but sam on 3, Episode 6 three days off; ZT
// Traitors, which riley follows openly through 2 and jordan privately through 4; casey is only on alex's other couch, ZT Extra) and
// solo-fixture.js (people on no couch). It grows with the step's parts; part 1 is watch along on your own time (watch-along.ts),
// part 2 who's on now and the live airing (below):
//   API:
//   - Tonight's card (GET /api/seasons/[id]/watch): sam's next episode (4, aired) with who on the couch left reactions there and how
//     many, alex's next to air (6, "soon": nothing in it);
//   - the refusals: an episode past your next (sam's 5, alex's 7: 403), saying something before an episode airs (409), a couch
//     you're not on (404), not a season (404), not an episode (400), a comment that's empty or too long, a kind that isn't one, a
//     GIF with no GIFs set up (409) or not KLIPY's (400), a moment that hasn't aired, too many at once (429);
//   - what reaches whom: the couch's reactions only 30 s after their moment (riley's at 1:00 reaches sam at 1:30, not 1:29.999),
//     yours at once, what's new since a moment, the pins and the couch's count on opening, a private watcher's (jordan's Traitors)
//     reaching nobody, another couch's (ZT Extra) never, alone (no couch) only yours, taking one back;
//   - an episode on air (Episode 6 moved to have started ten minutes ago): the card says live, nothing past what's aired reaches
//     anyone or can be said, sam (behind) can't watch it;
//   - GIFs: none without KLIPY_API_KEY or the stand-in (fake-gifs.js, `x-gys-gifs`), trending and a search with it.
//   In a real browser at --width (390 by default): as sam (with the stand-in's GIFs and a wake lock stand-in), Tonight's card,
//   the start, the screen kept on, Set the time, the couch's comments 30 s late and their pins, a reaction arriving on the poll,
//   reacting, saying something, a GIF, taking one back, pause, the bingo card, End with Reveal your scores, closing and picking up
//   where he left off; as riley (no GIFs: no button), the Traitors (a show she only watches): End, four stars marking Episode 3
//   seen and opening the verdict; as alex, Episode 6 on air (Live TV, Ad break, saying something), Up next's and Previously on's
//   Watch along on the hub; as zt_so_sam (solo, on 3), the solo hub's Watch along. Nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
// Part 2 is who's on now (watch_sessions, watch-sessions.ts):
//   API: a watch along's clock kept on the server as it starts, pauses, goes to an ad break and closes (the same session, its
//   version moving on); who's on it in the read, the card (the season's) and the hub's On now (/api/couches/[id]/now), each clock
//   read where it's got to; leaving at once, a beat bringing it back, a heartbeat 50 s old dropping out with no job; the running
//   poll writing its heartbeat only every 15 s or so, a read that isn't the poll none; never yourself, never on another couch,
//   never a private watcher or someone not following the show, each person once (their freshest); the live airing (On now's Live,
//   a card's live clock); the refusals (behind, past your next, before it airs, a bad mode or moment, a couch you're not on, alone
//   keeps nothing).
//   Browser: two at once, riley and sam on Episode 4: sam's Tonight card and start ("riley is on now · 1 watched earlier"), her
//   mark on his bar and "riley is watching now · 40-odd s ahead", Catch up (his clock to hers, on the server too), her pause
//   reaching his line on his next poll, her closing taking her off it; Join the live airing for alex from airtime (a touch
//   behind), then riley joining it in step with alex; the hub's On now (Live · Episode 6) opening his watch along to join her;
//   riley on the Traitors: On now's Have a look and The couch is watching's "riley is on".
// Part 3 is watching together (a planned night's session, one clock for everyone in it; migration 0133):
//   API: a night before anyone's opened it (no session, the night); the refusals (not on the couch, another couch, another episode,
//   not a plan, called off, the live airing before it airs, behind, starting a shared start an hour early, moving a clock you've
//   left or aren't in); opening it (making the session, joining it, leaving your own, saying you're in), the poll's look (just
//   the version while it's still it), the "3, 2, 1", a move, a pause and resume, an ad break and back, each for everyone, with who
//   did it; what the people in it say reaching the rest of them as they reach it (riley's 2:10 at sam's 2:11) while anything said
//   before it began, and everyone else's, still comes 30 s late; their bingo ticks on each other's cards (never one from before it
//   began, never to someone not in it), a tick moving the session on; leaving (the clock runs on for the rest; the last one out
//   stops it, and opening it again picks up there); who's on now; the live airing's night (its clock 70% from airtime, alex
//   joining in step, his ad break for everyone); By the numbers' most reactions and most watch alongs.
//   Browser: three at once on Episode 4, sam's shared start: sam opens it from his plate ("Watching together", Start at the same
//   time), riley says I'm in and opens it from hers, jordan joins from the hub's Up next ("Watch along · 2 going"); sam's "3, 2, 1"
//   pulls them both in, their clocks together; riley pauses for everyone (sam's and jordan's stop: "riley paused for everyone ·
//   Resume for everyone"), jordan resumes it for everyone; riley says something and sam has it at once; sam ticks a bingo square
//   and it shows on riley's card; riley closes it and sam's line says so; alex, late, says I'm in on the plan's sheet and joins
//   them where it is.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-watch-along.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and solo-fixture.js up and takes them down (--keep leaves them); touches zt
// rows only; refuses a non-local database (a KLIPY_API_KEY in .env.local is fine: it sends `x-gys-gifs: off` where it means none). Prints
// PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const soloFixture = require("./solo-fixture");
const fakeGifs = require("./fake-gifs");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-watch-along runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-watch-along.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const MIN = 60_000;

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const gifs = await fakeGifs.start();
  closers.push(gifs.close);
  try {
    const fx = await fixture.up(pool);
    const so = await soloFixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    const A = fx.couchId;
    const X = fx.extraCouchId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);

    const as = {};
    const withGifs = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) {
      as[who] = await api({ user: u(who), pass: PASSWORD, headers: { "x-gys-gifs": "off" } });
      withGifs[who] = await api({ user: u(who), pass: PASSWORD, headers: { "x-gys-gifs": gifs.url } });
    }
    const q = (couch, extra = {}) => {
      const p = new URLSearchParams({ ...(couch ? { couch } : {}), ...extra });
      return p.toString() ? `?${p}` : "";
    };
    const card = async (who, season = sid, couch = A) => (await as[who].call("GET", `/api/seasons/${season}/watch${q(couch)}`)).body;
    const read = (who, n, at, opts = {}) =>
      as[who].call(
        "GET",
        `/api/seasons/${opts.season ?? sid}/watch/${n}${q(opts.couch === undefined ? A : opts.couch, { at: String(at), ...(opts.since !== undefined ? { since: String(opts.since) } : {}), ...(opts.open ? { open: "1" } : {}) })}`
      );
    const say = (who, n, body, opts = {}) =>
      (opts.gifs ? withGifs : as)[who].call("POST", `/api/seasons/${opts.season ?? sid}/watch/${n}${q(opts.couch === undefined ? A : opts.couch)}`, body);
    const texts = (r) => (r.body.reactions ?? []).map((x) => `${x.name}@${x.runtimeMs}:${x.kind}${x.text ? `:${x.text}` : ""}`);
    const said = async (who, season = sid) => (await pool.query("SELECT * FROM watch_reactions WHERE user_id = $1 AND season_id = $2 ORDER BY runtime_ms", [U[who], season])).rows;

    // ---------- Tonight's card, and what's refused ----------
    let c = await card("sam");
    check(c.episode === 4 && c.status === "aired" && c.count === 0 && c.people.length === 0, "sam's card (on 3): Episode 4, aired, nobody's said anything yet", JSON.stringify(c));
    c = await card("alex");
    check(c.episode === 6 && c.status === "soon" && !!c.airAt && c.runtimeMin === 90 && c.count === 0, "alex's (on 5): Episode 6, opening at its airtime", JSON.stringify(c));
    let r = await read("sam", 5, 600_000);
    check(r.status === 403 && /Episode 4/.test(r.body.error), "sam can't watch along Episode 5 (past his next): 403", JSON.stringify(r.body));
    r = await read("alex", 7, 0);
    check(r.status === 403, "nor alex Episode 7: 403");
    r = await read("alex", 6, 0, { open: true });
    check(r.status === 200 && r.body.status === "soon" && r.body.reactions.length === 0 && r.body.through === -1, "Episode 6 before it airs: open, with nothing in it", JSON.stringify(r.body));
    r = await say("alex", 6, { at: 1000, kind: "fire" });
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "nothing can be said on it before it airs: 409", JSON.stringify(r.body));
    r = await read("riley", 4, 0, { couch: X });
    check(r.status === 404, "a couch you're not on: 404");
    r = await as.sam.call("GET", `/api/seasons/not-a-season/watch/4${q(A)}`);
    check(r.status === 404, "not a season: 404");
    r = await as.sam.call("GET", `/api/seasons/${sid}/watch/four${q(A)}`);
    check(r.status === 400, "not an episode: 400");
    for (const [body, status, re, what] of [
      [{ at: 1000, kind: "text", text: "   " }, 400, /Say something/, "an empty comment"],
      [{ at: 1000, kind: "text", text: "x".repeat(201) }, 400, /200 characters/, "a comment over 200 characters"],
      [{ at: 1000, kind: "heart" }, 400, /kind must be/, "a kind that isn't one"],
      [{ at: -5, kind: "fire" }, 400, /moment of the episode/, "a moment before the start"],
      [{ kind: "fire" }, 400, /moment of the episode/, "no moment"],
      [{ at: 1000, kind: "gif", gif: { id: "zt1", url: "https://static.klipy.com/zt1/200w.gif", w: 200, h: 150 } }, 409, /GIFs aren't on/, "a GIF with no GIFs set up"],
    ]) {
      r = await say("riley", 4, body);
      check(r.status === status && re.test(r.body.error), `${what}: ${status}`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await say("riley", 4, { at: 1000, kind: "gif", gif: { id: "zt1", url: "https://evil.example/zt1.gif", w: 200, h: 150 } }, { gifs: true });
    check(r.status === 400 && /KLIPY/.test(r.body.error), "a GIF that isn't KLIPY's (or the stand-in's): 400", JSON.stringify(r.body));
    check((await said("riley")).length === 0, "and nothing was kept");

    // ---------- GIFs ----------
    r = await as.riley.call("GET", "/api/gifs");
    check(r.status === 404, "GIFs with no key: 404 (and the watch along says gifs: false)");
    r = await withGifs.riley.call("GET", "/api/gifs");
    check(r.status === 200 && r.body.gifs.length === fakeGifs.GIFS.length && r.body.gifs.every((g) => g.url.startsWith(gifs.url) && g.preview && g.w === 200), "the stand-in: what's trending, each with its picture and a smaller one", JSON.stringify(r.body).slice(0, 200));
    r = await withGifs.riley.call("GET", "/api/gifs?q=clap");
    check(r.status === 200 && r.body.gifs.length === 1 && r.body.gifs[0].title === "Slow clap GIF", "a search: Slow clap");
    const clap = r.body.gifs[0];
    check(gifs.asked.some((a) => a.startsWith("/v2/search") && /q=clap/.test(a) && /contentfilter=low/.test(a)), "asked KLIPY's search, PG-13 at most (its low filter)");
    gifs.down = true;
    r = await withGifs.riley.call("GET", "/api/gifs?q=nope");
    check(r.status === 503, "KLIPY not answering: 503");
    gifs.down = false;
    r = await as.riley.call("GET", "/api/gifs");
    const signedOut = await fetch(`${BASE}/api/gifs`, { headers: { "x-gys-gifs": gifs.url } });
    check(signedOut.status === 401, "signed out: 401", String(signedOut.status));

    // ---------- the couch says things on Episode 4 (riley and jordan on 5, watching it again) ----------
    const posted = {};
    for (const [key, who, body] of [
      ["calm", "riley", { at: MIN, kind: "text", text: "zt: Kristin is SO calm" }],
      ["fire", "riley", { at: 75_000, kind: "fire" }],
      ["brutal", "jordan", { at: 2 * MIN, kind: "text", text: "  zt: that   challenge is brutal " }],
      ["gif", "jordan", { at: 150_000, kind: "gif", gif: { id: clap.id, url: clap.url, w: clap.w, h: clap.h, title: clap.title } }],
      ["idol", "riley", { at: 10 * MIN, kind: "text", text: "zt: IDOL CLUE" }],
    ]) {
      r = await say(who, 4, body, { gifs: key === "gif" });
      posted[key] = r.body.reaction;
      check(r.status === 200 && r.body.reaction?.mine && r.body.reaction.runtimeMs === body.at, `${who} says something at ${body.at / 1000}s (${body.kind})`, JSON.stringify(r.body));
    }
    check(posted.brutal.text === "zt: that challenge is brutal", "a comment is tidied");
    check(posted.gif.gif?.id === clap.id && posted.gif.gif.url === clap.url, "a GIF keeps its picture (the stand-in's, under next dev)");

    // ---------- what reaches sam (on 3, watching Episode 4) ----------
    r = await read("sam", 4, 0);
    check(r.status === 200 && r.body.status === "aired" && r.body.reactions.length === 0 && r.body.through === -1 && r.body.scope === "couch", "at 0:00: nothing yet", JSON.stringify(r.body));
    r = await read("sam", 4, 89_999);
    check(r.body.reactions.length === 0 && r.body.through === 59_999, "at 1:29.999: riley's 1:00 isn't there yet (30 s late, never early)", JSON.stringify(texts(r)));
    r = await read("sam", 4, 90_000);
    check(JSON.stringify(texts(r)) === JSON.stringify(["zt_nd_riley@60000:text:zt: Kristin is SO calm"]), "at 1:30: riley's comment", JSON.stringify(texts(r)));
    check(r.body.pins === null && r.body.count === null && r.body.people === null, "a poll carries no pins or count");
    r = await read("sam", 4, 105_000);
    check(texts(r).length === 2 && r.body.reactions[1].kind === "fire" && r.body.reactions[1].text === null, "at 1:45: and her fire at 1:15");
    r = await read("sam", 4, 700_000, { open: true });
    check(texts(r).length === 5 && r.body.through === 670_000, "at 11:40 everything through 11:10", JSON.stringify(texts(r)));
    check(JSON.stringify(r.body.pins) === JSON.stringify([60_000, 120_000, 150_000, 600_000]), "opening: the pins are the comments and GIFs passed", JSON.stringify(r.body.pins));
    check(r.body.count === 5 && JSON.stringify(r.body.people.map((p) => p.name)) === JSON.stringify(["zt_nd_riley", "zt_nd_jordan"]), "and the couch's count, most first", JSON.stringify(r.body.people));
    check(r.body.gifs === false && r.body.you.following === true && r.body.you.private === false && r.body.you.seen === false, "no GIFs here; sam follows it openly and hasn't seen it");
    r = await read("sam", 4, 700_000, { since: 130_000 });
    check(JSON.stringify(r.body.reactions.map((x) => x.runtimeMs)) === "[150000,600000]", "what's new since 2:10: the GIF and the idol clue", JSON.stringify(texts(r)));
    r = await withGifs.sam.call("GET", `/api/seasons/${sid}/watch/4${q(A, { at: "0" })}`);
    check(r.body.gifs === true, "with the stand-in: gifs: true");
    c = await card("sam");
    check(c.episode === 4 && c.count === 5 && c.people.map((p) => p.name).join() === "zt_nd_riley,zt_nd_jordan", "sam's card: riley and jordan left 5 reactions", JSON.stringify(c));

    // Your own come back at once, the couch's 30 s on.
    r = await say("sam", 4, { at: 30_000, kind: "text", text: "zt: sam here" });
    const samHere = r.body.reaction;
    check(r.status === 200, "sam says something at 0:30");
    r = await read("sam", 4, 30_000);
    check(texts(r).join() === "zt_nd_sam@30000:text:zt: sam here" && r.body.reactions[0].mine, "his own at 0:30: there at once");
    r = await read("riley", 4, 59_999);
    check(!texts(r).some((t) => /sam here/.test(t)), "riley at 0:59.999: not yet");
    r = await read("riley", 4, 60_000);
    check(texts(r).some((t) => /sam here/.test(t)) && texts(r).some((t) => /riley@60000/.test(t)), "at 1:00: sam's, and her own at 1:00", JSON.stringify(texts(r)));

    // ---------- whose reach whom ----------
    // Another couch: alex and casey's ZT Extra hears nothing the main couch said.
    r = await read("alex", 4, 700_000, { couch: X, open: true });
    check(r.status === 200 && r.body.reactions.length === 0 && r.body.count === 0 && r.body.pins.length === 0, "another couch (ZT Extra): none of it", JSON.stringify(texts(r)));
    r = await say("casey", 4, { at: 3 * MIN, kind: "text", text: "zt: casey on the other couch" }, { couch: X });
    check(r.status === 200, "casey says something there");
    r = await read("alex", 4, 700_000, { couch: X });
    check(texts(r).join() === "zt_nd_casey@180000:text:zt: casey on the other couch", "alex on ZT Extra: casey's");
    r = await read("alex", 4, 700_000);
    check(texts(r).length === 6 && !texts(r).some((t) => /casey/.test(t)), "alex on the main couch: its six, not casey's", JSON.stringify(texts(r)));
    // Alone: no couch, only yours.
    r = await say("alex", 4, { at: 4 * MIN, kind: "crown" }, { couch: null });
    r = await read("alex", 4, 700_000, { couch: null, open: true });
    check(r.body.scope === "solo" && r.body.through === -1 && texts(r).join() === "zt_nd_alex@240000:crown" && r.body.count === 0, "on your own (no couch): only what you said there", JSON.stringify(texts(r)));
    // A private watcher's stay theirs: jordan watches the Traitors privately (on 4), riley openly (on 2).
    r = await say("jordan", 3, { at: MIN, kind: "text", text: "zt: jordan, privately" }, { season: tsid });
    check(r.status === 200, "jordan (watching the Traitors privately) says something on Episode 3");
    r = await say("riley", 3, { at: 2 * MIN, kind: "text", text: "zt: riley on the Traitors" }, { season: tsid });
    r = await read("riley", 3, 20 * MIN, { season: tsid, open: true });
    check(texts(r).join() === "zt_nd_riley@120000:text:zt: riley on the Traitors" && r.body.count === 0, "riley: her own, never jordan's", JSON.stringify(texts(r)));
    r = await read("jordan", 3, 20 * MIN, { season: tsid, open: true });
    check(texts(r).length === 2 && r.body.you.private === true && r.body.you.seen === true, "jordan: both (riley shares it), told he's watching privately", JSON.stringify(r.body.you));
    c = await card("riley", tsid);
    check(c.episode === 3 && c.count === 0, "riley's Traitors card: Episode 3, nobody she can hear from", JSON.stringify(c));
    // alex doesn't follow the Traitors: his next is Episode 1, and what he says there is his alone.
    r = await read("alex", 3, 0, { season: tsid });
    check(r.status === 403, "alex (not following the Traitors, on 0) can't watch along its Episode 3");
    r = await say("alex", 1, { at: MIN, kind: "text", text: "zt: alex not following" }, { season: tsid });
    r = await read("riley", 1, 20 * MIN, { season: tsid });
    check(r.status === 200 && !texts(r).some((t) => /alex/.test(t)), "someone not following it: what they say reaches nobody");

    // Taking one back: yours only.
    r = await as.riley.call("DELETE", `/api/seasons/${sid}/watch/4/${posted.brutal.id}`);
    check(r.status === 404, "riley can't take back jordan's: 404");
    r = await as.riley.call("DELETE", `/api/seasons/${sid}/watch/4/${posted.idol.id}`);
    check(r.status === 200 && r.body.ok, "she takes back her own");
    r = await read("sam", 4, 700_000);
    check(!texts(r).some((t) => /IDOL/.test(t)), "and it's gone for sam");
    r = await say("riley", 4, { at: 10 * MIN, kind: "text", text: "zt: IDOL CLUE" });
    posted.idol = r.body.reaction;

    // Too many at once.
    let last = null;
    for (let i = 0; i < 13; i++) last = await say("alex", 5, { at: 5 * MIN + i * 1000, kind: "laugh" });
    check(last.status === 429 && /Slow down/.test(last.body.error), "the 13th reaction inside ten seconds: 429", JSON.stringify(last.body));
    await pool.query("DELETE FROM watch_reactions WHERE user_id = $1 AND season_id = $2 AND episode = 5", [U.alex, sid]);

    // ---------- Episode 6 on air (started ten minutes ago) ----------
    const onAir = async () =>
      pool.query(
        `UPDATE show_seasons SET premiere_date = ((now() AT TIME ZONE air_tz) - interval '10 minutes')::date - 35, air_time = ((now() AT TIME ZONE air_tz) - interval '10 minutes')::time WHERE id = $1`,
        [sid]
      );
    await onAir();
    c = await card("alex");
    check(c.episode === 6 && c.status === "live", "alex's card: Episode 6, live", JSON.stringify(c));
    r = await say("riley", 6, { at: 4 * MIN, kind: "text", text: "zt: live and loving it" });
    check(r.status === 200, "riley, watching live, says something at 4:00");
    r = await say("riley", 6, { at: 16 * MIN, kind: "fire" });
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "a moment past what's aired (16:00, ten minutes in): 409", JSON.stringify(r.body));
    r = await read("alex", 6, 269_999);
    check(r.body.status === "live" && r.body.reactions.length === 0, "alex at 4:29.999: not yet");
    r = await read("alex", 6, 270_000);
    check(texts(r).join() === "zt_nd_riley@240000:text:zt: live and loving it", "at 4:30: riley's");
    r = await read("alex", 6, 45 * MIN);
    // The schedule keeps airtime to the minute, so Episode 6 began 10:00 to 10:59 ago: what's aired, 30 s back, is 9:30 to 10:29 (and on).
    check(r.body.through >= 9 * MIN && r.body.through < 11 * MIN, "a clock ahead of the airing (45:00): only what's aired, 30 s back", String(r.body.through));
    r = await read("sam", 6, 0);
    check(r.status === 403, "sam (behind) can't watch along it");

    // ---------- part 2: who's on now (watch_sessions; Episode 6 is still on air) ----------
    const session = (who, n, body, opts = {}) => as[who].call("POST", `/api/seasons/${opts.season ?? sid}/watch/${n}/session${q(opts.couch === undefined ? A : opts.couch)}`, body);
    const onNow = async (who, couch = A) => (await as[who].call("GET", `/api/couches/${couch}/now`)).body.now;
    const names = (list) => (list ?? []).map((w) => w.name.replace(/^zt_nd_/, "")).join();
    const sessions = async (who) =>
      (await pool.query("SELECT s.*, p.seen_at, p.left_at FROM watch_sessions s JOIN watch_session_people p ON p.session_id = s.id WHERE p.user_id = $1 ORDER BY s.created_at", [U[who]])).rows;
    const go = (at, extra = {}) => ({ at, mode: "stream", running: true, ad: false, ...extra });
    const beatAgo = async (who) => Number((await pool.query("SELECT extract(epoch FROM now() - max(seen_at)) AS ago FROM watch_session_people WHERE user_id = $1", [U[who]])).rows[0].ago);
    const pollAs = (who, n, at, beat) => as[who].call("GET", `/api/seasons/${sid}/watch/${n}${q(A, { at: String(at), since: String(at - 5000), ...(beat ? { beat: "1" } : {}) })}`);

    r = await session("riley", 4, go(MIN));
    const rs = r.body.session;
    check(r.status === 200 && !!rs?.id && r.body.now.length === 0, "riley starts Episode 4's watch along at 1:00: a session, nobody else on it", JSON.stringify(r.body));
    let mine = await sessions("riley");
    check(mine.length === 1 && mine[0].episode === 4 && mine[0].couch_id === A && mine[0].mode === "stream" && mine[0].clock_ms === MIN && !!mine[0].running_since && !mine[0].left_at && !mine[0].together, "kept on the server: her clock, running from 1:00, on the couch", JSON.stringify(mine[0]));
    r = await read("sam", 4, 30_000);
    let rw = r.body.now?.[0];
    check(r.body.now?.length === 1 && rw.name === u("riley") && rw.episode === 4 && rw.mode === "stream" && rw.running && !rw.ad && rw.at >= MIN && rw.at < MIN + 10_000, "sam's read of Episode 4: riley is watching it now, her clock just past 1:00", JSON.stringify(r.body.now));
    check(!("seasonId" in rw) && Object.keys(rw).sort().join() === "ad,at,episode,mode,name,running,userId", "a watcher is who, which episode and their clock: nothing else", Object.keys(rw).join());
    c = await card("sam");
    check(names(c.now) === "riley" && c.now[0].episode === 4, "sam's card: riley on Episode 4 now", JSON.stringify(c.now));
    c = await card("alex");
    check(c.episode === 6 && names(c.now) === "riley" && c.now[0].episode === 4, "alex's card (Episode 6, live) carries the season's: riley on Episode 4", JSON.stringify(c.now));
    let on = await onNow("alex");
    check(on.length === 1 && on[0].name === u("riley") && on[0].seasonId === sid && on[0].episode === 4 && on[0].live === false && /Survivor/.test(on[0].header.show.name), "alex's hub, On now: riley watching ZT Survivor, Episode 4", JSON.stringify(on));
    check((await onNow("riley")).length === 0 && (await read("riley", 4, MIN)).body.now.length === 0, "riley never sees herself on now");

    // Pause, an ad break, closing it.
    r = await session("riley", 4, go(90_000, { running: false }));
    check(r.status === 200 && r.body.session.id === rs.id && r.body.session.version === rs.version + 1, "she pauses at 1:30: the same session, written again (its version moves on)", JSON.stringify(r.body.session));
    const p1 = (await read("sam", 4, 30_000)).body.now[0];
    await new Promise((res) => setTimeout(res, 1100));
    const p2 = (await read("sam", 4, 30_000)).body.now[0];
    check(p1.at === 90_000 && p2.at === 90_000 && !p1.running, "paused: her clock stands at 1:30", JSON.stringify([p1, p2]));
    await session("riley", 4, go(95_000, { mode: "live", running: false, ad: true }));
    rw = (await read("sam", 4, 30_000)).body.now[0];
    check(rw.ad && rw.mode === "live" && !rw.running && rw.at === 95_000, "an ad break on live TV: her clock waits at 1:35", JSON.stringify(rw));
    r = await session("riley", 4, { at: 100_000, leave: true });
    check(r.status === 200 && r.body.session === null, "she closes it at 1:40");
    mine = await sessions("riley");
    check(!!mine[0].left_at && mine[0].clock_ms === 100_000 && !mine[0].running_since && !mine[0].ad, "closed: her clock stopped where she left, and she's left", JSON.stringify(mine[0]));
    check((await read("sam", 4, 30_000)).body.now.length === 0 && (await onNow("alex")).length === 0, "and she's off sam's watch along and alex's On now at once");
    await pool.query("UPDATE watch_session_people SET seen_at = now() - interval '20 seconds' WHERE user_id = $1", [U.riley]);
    await pollAs("riley", 4, 100_000, true);
    check((await onNow("alex")).length === 0, "a poll still on its way as she closed it doesn't bring her back");
    r = await session("riley", 4, { beat: true });
    check(r.status === 200 && (await onNow("alex")).length === 1, "a beat from the same watch along (a page come back): she's on again");
    await pool.query("UPDATE watch_session_people SET seen_at = now() - interval '50 seconds' WHERE user_id = $1", [U.riley]);
    check((await onNow("alex")).length === 0 && (await read("sam", 4, 30_000)).body.now.length === 0, "her last heartbeat 50 s ago (a phone gone to sleep): dropped out, worked out on read");

    // The running poll is the heartbeat, written only now and then.
    await session("riley", 4, go(2 * MIN));
    await pool.query("UPDATE watch_session_people SET seen_at = now() - interval '5 seconds' WHERE user_id = $1", [U.riley]);
    await pollAs("riley", 4, 125_000, true);
    check((await beatAgo("riley")) >= 4.5, "her poll 5 s after a heartbeat: just a look, nothing written", String(await beatAgo("riley")));
    await pool.query("UPDATE watch_session_people SET seen_at = now() - interval '20 seconds' WHERE user_id = $1", [U.riley]);
    await pollAs("riley", 4, 130_000, false);
    check((await beatAgo("riley")) >= 19, "a read that isn't the poll (opening, a jump): no heartbeat");
    await pollAs("riley", 4, 130_000, true);
    check((await beatAgo("riley")) < 3, "20 s on, the poll writes it", String(await beatAgo("riley")));

    // Who sees whom: the couch it's opened on only, and only someone who follows the show openly.
    r = await session("alex", 4, go(3 * MIN), { couch: X });
    check(r.status === 200 && names(await onNow("casey", X)) === "alex" && names((await read("casey", 4, MIN, { couch: X })).body.now) === "alex", "alex on ZT Extra: casey sees him on now, on her hub and in her watch along");
    check(!names(await onNow("sam")).includes("alex") && !names((await read("sam", 4, 30_000)).body.now).includes("alex"), "the main couch doesn't");
    r = await session("jordan", 3, go(MIN), { season: tsid });
    check(r.status === 200, "jordan (watching the Traitors privately) opens its Episode 3");
    check(!names(await onNow("riley")).includes("jordan") && (await card("riley", tsid)).now.length === 0 && (await read("riley", 3, MIN, { season: tsid })).body.now.length === 0, "a private watcher is never on now: not on riley's hub, card or watch along");
    r = await session("alex", 1, go(MIN), { season: tsid });
    check(r.status === 200 && !names(await onNow("riley")).includes("alex"), "nor someone who doesn't follow it (alex on the Traitors' Episode 1)");
    await session("riley", 5, go(MIN));
    on = await onNow("sam");
    check(on.filter((w) => w.name === u("riley")).length === 1 && on.find((w) => w.name === u("riley")).episode === 5, "riley with two open (Episodes 4 and 5): on once, her freshest", JSON.stringify(on));

    // The live airing: alex on Episode 6, live.
    r = await session("alex", 6, go(7 * MIN, { mode: "live" }));
    on = await onNow("sam");
    const ax = on.find((w) => w.name === u("alex"));
    check(!!ax && ax.episode === 6 && ax.live === true && ax.mode === "live" && ax.at >= 7 * MIN, "alex on Episode 6 live: sam's On now says it's the live airing", JSON.stringify(on));
    c = await card("riley");
    check(c.episode === 6 && c.status === "live" && c.now.some((w) => w.name === u("alex") && w.mode === "live" && w.episode === 6 && w.running), "riley's card (her next, on air): alex on it, live, his clock running", JSON.stringify(c.now));
    r = await session("sam", 6, go(0, { mode: "live" }));
    check(r.status === 403, "sam (behind) can't open Episode 6: 403", JSON.stringify(r.body));

    // What's refused.
    r = await session("riley", 6, go(MIN, { mode: "tv" }));
    check(r.status === 400 && /mode/.test(r.body.error), "a mode that isn't one: 400", JSON.stringify(r.body));
    r = await session("riley", 6, { mode: "stream", running: true });
    check(r.status === 400 && /moment/.test(r.body.error), "no moment: 400", JSON.stringify(r.body));
    r = await session("riley", 6, go(-1));
    check(r.status === 400, "a moment before the start: 400");
    r = await session("riley", 4, go(MIN), { couch: X });
    check(r.status === 404, "a couch you're not on: 404");
    r = await as.riley.call("GET", `/api/couches/${X}/now`);
    check(r.status === 404, "nor its On now: 404");
    const before = (await sessions("riley")).length;
    r = await session("riley", 4, go(MIN), { couch: null });
    check(r.status === 200 && r.body.session === null && (await sessions("riley")).length === before, "alone (no couch): nothing kept");
    r = await session("riley", 7, go(0));
    check(r.status === 403, "past her next episode: 403");
    await pool.query("UPDATE show_seasons SET premiere_date = current_date + 3 - 35, air_time = '20:00' WHERE id = $1", [sid]);
    r = await session("alex", 6, go(0, { mode: "live" }));
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "Episode 6 before it airs: nothing to keep (409)", JSON.stringify(r.body));
    await onAir();
    check(!(await sessions("riley")).some((x) => x.together), "every session so far is someone's own (together ones are part 3's)");
    await pool.query("DELETE FROM watch_sessions WHERE season_id = ANY($1::uuid[])", [[sid, tsid]]);

    // ---------- part 3: watching together (a planned night's session, one clock for everyone in it) ----------
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const planNight = (who, body) => as[who].call("POST", `/api/seasons/${sid}/plans${q(A)}`, body);
    const tget = (who, n, plan, extra = {}, couch = A) => as[who].call("GET", `/api/seasons/${sid}/watch/${n}/together${q(couch, { plan, ...extra })}`);
    const tpost = (who, n, body, couch = A) => as[who].call("POST", `/api/seasons/${sid}/watch/${n}/together${q(couch)}`, body);
    const tmove = (who, n, id, change, at, extra = {}) => tpost(who, n, { id, change, at, mode: "stream", running: change !== "pause", ad: false, ...extra });
    const here = (t) => (t?.people ?? []).filter((x) => x.here).map((x) => x.name.replace(/^zt_nd_/, "")).join();
    const readTogether = (who, n, at, since, id, extra = {}) =>
      as[who].call("GET", `/api/seasons/${sid}/watch/${n}${q(A, { at: String(at), since: String(since), ...(id ? { together: id } : {}), ...extra })}`);

    // sam (on 3) plans Episode 4 together, a shared start ten minutes from now, with riley and jordan (both on 5).
    r = await planNight("sam", { episode: 4, how: "start", startsAt: new Date(Date.now() + 10 * MIN).toISOString(), invite: [U.riley, U.jordan] });
    check(r.status === 200 && !!r.body.plan?.id, "sam plans Episode 4 together, ten minutes from now", JSON.stringify(r.body).slice(0, 200));
    const night = r.body.plan;
    r = await tget("sam", 4, night.id);
    check(r.status === 200 && r.body.version === null && r.body.together === null && r.body.night?.how === "start" && names(r.body.night.in) === "sam", "before anyone's opened it: no session, just the night (a shared start, sam in)", JSON.stringify(r.body));
    r = await tget("casey", 4, night.id);
    check(r.status === 404, "someone not on the couch: 404");
    r = await tget("casey", 4, night.id, {}, X);
    check(r.status === 404, "asked on another couch: 404");
    r = await tget("riley", 5, night.id);
    check(r.status === 404, "the night asked on another episode: 404");
    r = await tget("sam", 4, "not-a-plan");
    check(r.status === 400, "not a plan: 400");

    // Opening it (it's due: a shared start ten minutes off) joins it; riley had her own watch along of Episode 4 open.
    await session("riley", 4, go(2 * MIN));
    r = await tpost("sam", 4, { plan: night.id, join: true });
    let t = r.body.together;
    check(r.status === 200 && !!t && !t.started && !t.running && t.at === 0 && t.you && here(t) === "sam" && t.how === "start" && t.startsAt === night.startsAt, "sam opens it: a session, waiting for someone to start it, him in it", JSON.stringify(t));
    const tid = t.id;
    let v = t.version;
    r = await tpost("riley", 4, { plan: night.id, join: true });
    t = r.body.together;
    check(t?.id === tid && t.version > v && here(t) === "sam,riley", "riley opens it: the same session, its version moved on, both here", JSON.stringify(t));
    const ownEp4 = (await sessions("riley")).find((x) => !x.together && x.episode === 4);
    check(!!ownEp4?.left_at && !ownEp4.running_since, "and her own watch along of Episode 4 is closed (joining one leaves your own)", JSON.stringify(ownEp4));
    check((await pool.query("SELECT answer FROM watch_plan_people WHERE plan_id = $1 AND user_id = $2", [night.id, U.riley])).rows[0]?.answer === "in", "opening it says she's in");
    check((await pool.query("SELECT count(*)::int AS n FROM watch_sessions WHERE plan_id = $1 AND together", [night.id])).rows[0].n === 1, "one session for the night");
    on = await onNow("alex");
    check(names(on.filter((w) => w.episode === 4)) === "riley,sam", "alex's On now: riley and sam on Episode 4 (in it, each with its clock)", JSON.stringify(on));

    // The open watch along's look: just the version while it's still it.
    v = t.version;
    r = await tget("sam", 4, night.id, { v: String(v), beat: "1" });
    check(r.status === 200 && r.body.version === v && r.body.together === null && r.body.night === null && r.body.now === null && JSON.stringify(r.body).length < 80, "the poll's look with the version it has: just the version, a few bytes", JSON.stringify(r.body));
    r = await tget("sam", 4, night.id, { v: String(v - 1) });
    check(r.body.together?.version === v && Array.isArray(r.body.now), "with an older one: the session, and who's on the episode");

    // Starting a shared start an hour early is refused; a night called off is closed (leaving still works).
    r = await planNight("riley", { episode: 3, how: "start", startsAt: new Date(Date.now() + 60 * MIN).toISOString(), invite: [U.sam] });
    const later = r.body.plan;
    r = await tpost("riley", 3, { plan: later.id, join: true });
    const laterId = r.body.together?.id;
    check(r.status === 200 && !!laterId, "an hour off, its watch along can be opened", JSON.stringify(r.body).slice(0, 200));
    r = await tmove("riley", 3, laterId, "start", 0);
    check(r.status === 409 && /15 minutes/.test(r.body.error), "but not started an hour early: 409", JSON.stringify(r.body));
    await as.riley.call("POST", `/api/plans/${later.id}`, { cancel: true });
    r = await tget("riley", 3, later.id);
    check(r.status === 409 && /called off/.test(r.body.error), "a night called off: 409", JSON.stringify(r.body));
    r = await tpost("riley", 3, { id: laterId, leave: true });
    check(r.status === 200, "leaving still works once it's called off");

    // The "3, 2, 1".
    r = await tmove("sam", 4, tid, "start", 0);
    t = r.body.together;
    check(r.status === 200 && t.started && t.running && t.startsInMs > 3500 && t.startsInMs <= 5000 && t.at === 0 && t.change?.what === "start" && t.change.by === u("sam"), "sam starts it: a five-second 3, 2, 1 for everyone in it", JSON.stringify(t));
    r = await tget("riley", 4, night.id, { v: String(v) });
    check(r.body.together?.startsInMs > 0 && r.body.together.change.what === "start", "riley's next look: the countdown, sam started it", JSON.stringify(r.body.together));
    await sleep(5300);
    t = (await tget("riley", 4, night.id)).body.together;
    check(t.running && t.startsInMs === 0 && t.at >= 0 && t.at < 3000, "five seconds on: the clock runs from 0:00", JSON.stringify(t));
    r = await tmove("riley", 4, tid, "move", 2 * MIN);
    t = r.body.together;
    check(t.change.what === "move" && t.change.by === u("riley") && t.at >= 2 * MIN && t.at < 2 * MIN + 2000 && t.running, "riley moves it to 2:00, for everyone, running on", JSON.stringify(t));
    r = await tmove("riley", 4, tid, "pause", 125_000, { running: false });
    t = r.body.together;
    check(!t.running && t.at === 125_000 && t.change.what === "pause" && t.change.by === u("riley"), "she pauses it at 2:05: stopped for everyone", JSON.stringify(t));
    t = (await tget("sam", 4, night.id)).body.together;
    await sleep(1100);
    const t2 = (await tget("sam", 4, night.id)).body.together;
    check(!t.running && t.at === 125_000 && t2.at === 125_000 && t.change.by === u("riley"), "sam's looks: stopped at 2:05, riley paused it");
    r = await tmove("jordan", 4, tid, "resume", 125_000);
    check(r.status === 409, "jordan (not in it) can't move it: 409", JSON.stringify(r.body));
    r = await tmove("sam", 4, tid, "rewind", 125_000);
    check(r.status === 400 && /change must be/.test(r.body.error), "a change that isn't one: 400");
    r = await tmove("sam", 4, tid, "resume", 125_000, { mode: "tv" });
    check(r.status === 400 && /mode/.test(r.body.error), "a mode that isn't one: 400");
    r = await tmove("sam", 4, tid, "ad", 125_000, { running: false, ad: true, mode: "live" });
    check(r.body.together.ad && !r.body.together.running && r.body.together.change.what === "ad", "an ad break, for everyone");
    r = await tmove("sam", 4, tid, "show", 125_000, { mode: "live" });
    check(!r.body.together.ad && r.body.together.running && r.body.together.change.what === "show", "and back to the show");
    r = await tmove("sam", 4, tid, "resume", 125_000);
    check(r.body.together.running && r.body.together.change.by === u("sam"), "sam resumes it for everyone at 2:05");

    // What the people in it say comes as you reach it (the same clock); before it began, and everyone else's, 30 s late.
    r = await say("riley", 4, { at: 130_000, kind: "text", text: "zt: together now" });
    check(r.status === 200, "riley says something at 2:10, in it");
    r = await readTogether("sam", 4, 131_000, 125_000, tid);
    check(texts(r).some((x) => /together now/.test(x)), "sam at 2:11, together: riley's 2:10 at once", JSON.stringify(texts(r)));
    check(r.body.together?.version >= 1 && r.body.through === 101_000, "the read carries the session's version (and the couch's 30 s line as ever)", JSON.stringify(r.body.together));
    r = await readTogether("sam", 4, 131_000, 125_000, null);
    check(!texts(r).some((x) => /together now/.test(x)), "the same read on his own time: not yet (30 s late)");
    r = await readTogether("jordan", 4, 131_000, 125_000, tid);
    check(!texts(r).some((x) => /together now/.test(x)) && !r.body.together?.state && r.body.together?.version === null, "jordan (not in it), even naming it: not yet, and no session for him");
    r = await readTogether("sam", 4, 70_000, -1, tid);
    check(!texts(r).some((x) => /Kristin/.test(x)), "riley's 1:00 from before it began: still 30 s late at sam's 1:10");
    r = await readTogether("sam", 4, 140_000, 125_000, tid, { sv: String((await tget("sam", 4, night.id)).body.together.version) });
    check(r.body.together?.state === null && typeof r.body.together?.version === "number", "with the version it has: no session in the answer");

    // Bingo: what the people in it tick shows on each other's cards, from when it began.
    const bingoOf = async (who, n = 4) => (await as[who].call("GET", `/api/seasons/${sid}/bingo/${n}${q(A)}`)).body;
    let bcard = await bingoOf("sam");
    const sq = bcard.squares.map((s, i) => [s, i]).filter(([s]) => s.key !== "free").map(([, i]) => i);
    check(sq.length >= 2, "sam's Episode 4 card", JSON.stringify(bcard).slice(0, 200));
    const vBefore = (await tget("sam", 4, night.id)).body.together;
    await as.sam.call("POST", `/api/seasons/${sid}/bingo/4${q(A)}`, { square: sq[0], ticked: true });
    await as.sam.call("POST", `/api/seasons/${sid}/bingo/4${q(A)}`, { square: sq[1], ticked: true });
    const vAfter = (await tget("sam", 4, night.id)).body.together;
    check(vAfter.version >= vBefore.version + 2 && vAfter.ticks === vBefore.ticks + 2, "two ticks: the session moves on, its tick count with it", `${vBefore.version}->${vAfter.version} ${vBefore.ticks}->${vAfter.ticks}`);
    await pool.query(
      "UPDATE bingo_marks SET marked_at = now() - interval '1 day' WHERE square = $1 AND card_id = (SELECT id FROM bingo_cards WHERE user_id = $2 AND season_id = $3 AND episode = 4)",
      [sq[1], U.sam, sid]
    );
    bcard = await bingoOf("riley");
    const samSquares = (await bingoOf("sam")).squares;
    check(bcard.together?.length === 1 && bcard.together[0].name === u("sam") && JSON.stringify(bcard.together[0].keys) === JSON.stringify([samSquares[sq[0]].key]), "riley's card: sam's tick from in it (not the one from before it began)", JSON.stringify(bcard.together));
    check((await bingoOf("jordan")).together.length === 0, "jordan's (not in it): nobody's");

    // Leaving: the clock runs on for the rest; the last one out stops it; opening it again picks up there.
    await tpost("riley", 4, { id: tid, leave: true });
    t = (await tget("sam", 4, night.id)).body.together;
    check(here(t) === "sam" && t.running, "riley closes it: she's out, the clock runs on for sam", JSON.stringify(t));
    r = await tmove("riley", 4, tid, "pause", 150_000, { running: false });
    check(r.status === 409 && /left/.test(r.body.error), "moving a clock you've left: 409", JSON.stringify(r.body));
    await tpost("sam", 4, { id: tid, leave: true });
    t = (await tget("sam", 4, night.id)).body.together;
    check(!t.running && here(t) === "" && t.change.what === "pause" && t.change.by === null && !t.you && t.at >= 125_000, "sam, the last, closes it: it stops where it is, a pause nobody made", JSON.stringify(t));
    r = await tpost("sam", 4, { plan: night.id, join: true });
    check(r.body.together.id === tid && r.body.together.you && r.body.together.at === t.at && !r.body.together.running, "opening it again: back in it, where it stopped", JSON.stringify(r.body.together));
    await tpost("sam", 4, { id: tid, leave: true });

    // The live airing's night: alex plans Episode 6's (three days off), then it airs.
    await pool.query("UPDATE show_seasons SET premiere_date = current_date + 3 - 35, air_time = '20:00' WHERE id = $1", [sid]);
    r = await planNight("alex", { episode: 6, how: "live", invite: [U.riley] });
    const liveNight = r.body.plan;
    check(r.status === 200 && liveNight?.how === "live", "alex plans Episode 6's live airing with riley");
    r = await tpost("riley", 6, { plan: liveNight.id, join: true });
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "opening it before it airs: 409", JSON.stringify(r.body));
    r = await tget("riley", 6, liveNight.id);
    check(r.status === 200 && r.body.together === null && r.body.night?.how === "live", "its night can be read meanwhile (the start says when it opens)");
    await onAir();
    r = await tpost("riley", 6, { plan: liveNight.id, join: true });
    t = r.body.together;
    check(t?.started && t.running && t.mode === "live" && t.change?.what === "start" && t.at >= 6.5 * MIN && t.at <= 8 * MIN, "on air: riley opens it, its clock the live airing's (70% from airtime: nobody to follow)", JSON.stringify(t));
    r = await tpost("alex", 6, { plan: liveNight.id, join: true });
    const ta = r.body.together;
    check(ta?.id === t.id && Math.abs(ta.at - t.at) < 3000 && here(ta) === "riley,alex", "alex opens it: the same clock", JSON.stringify(ta));
    r = await tmove("alex", 6, ta.id, "ad", ta.at, { mode: "live", running: false, ad: true });
    check(r.body.together.ad && !r.body.together.running, "alex: an ad break, for everyone");
    t = (await tget("riley", 6, liveNight.id)).body.together;
    check(t.ad && t.change.what === "ad" && t.change.by === u("alex"), "riley's look: in an ad break, alex started it", JSON.stringify(t));
    r = await tpost("sam", 6, { plan: liveNight.id, join: true });
    check(r.status === 403, "sam (behind) can't open it: 403");
    await tpost("riley", 6, { id: ta.id, leave: true });
    await tpost("alex", 6, { id: ta.id, leave: true });

    // By the numbers: most reactions this month and most watch alongs (riley's: Episode 4 and the live airing).
    const hubRead = (await as.alex.call("GET", `/api/couches/${A}/hub`)).body;
    const acc = (k) => (hubRead.accolades ?? []).find((a) => a.key === k);
    check(acc("reactions")?.who === u("riley") && /^\d+ reactions$/.test(acc("reactions").line) && acc("reactions").stat === "Most reactions this month", "By the numbers: most reactions this month, riley", JSON.stringify(hubRead.accolades));
    check(acc("watch-alongs")?.who === u("riley") && acc("watch-alongs").line === "2 this month" && acc("watch-alongs").stat === "Most watch alongs", "and most watch alongs: riley, 2 this month", JSON.stringify(acc("watch-alongs")));
    check(!/Episode|Ep \d/.test(JSON.stringify([acc("reactions"), acc("watch-alongs")])), "counted, never which episode");

    // Tidy for the browser (part 1's counts expect Episode 4's reactions as they were).
    await pool.query("DELETE FROM watch_reactions WHERE user_id = $1 AND text = 'zt: together now'", [U.riley]);
    await pool.query("DELETE FROM bingo_cards WHERE season_id = $1", [sid]);
    await pool.query("DELETE FROM watch_plans WHERE couch_id = $1", [A]);
    await pool.query("DELETE FROM watch_sessions WHERE season_id = ANY($1::uuid[])", [[sid, tsid]]);

    // ---------- the browser ----------
    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      // A stand-in for the screen wake lock (headless Chromium refuses the real one): it records what's asked.
      const wake = () => {
        window.__wake = [];
        Object.defineProperty(navigator, "wakeLock", {
          configurable: true,
          value: {
            request: async (type) => {
              window.__wake.push(type);
              const t = new EventTarget();
              t.released = false;
              t.type = type;
              t.release = async () => {
                t.released = true;
                window.__wake.push("released");
                t.dispatchEvent(new Event("release"));
              };
              return t;
            },
          },
        });
      };
      let n = 0;
      const browse = async (user, label, headers) => {
        const b = await open({ user, pass: PASSWORD, width, height: 844, motion: "off", headers });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.context().addInitScript(wake);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const pg = b.page;
        return {
          pg,
          shot: async (name) => {
            await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
            await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${label}-${name}.png`) });
          },
          wide: async (what) => {
            const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
          },
          errors: () => b.errors.filter((x) => !/Failed to load resource/.test(x)).concat(b.errors.filter((x) => /Failed to load resource/.test(x)).slice(favicon)),
          sheet: () => pg.locator("[role=dialog][data-open]"),
        };
      };
      const layer = "[data-watch-along]";
      const clockOf = async (pg) => Number(await pg.locator("[data-watch-clock]").getAttribute("data-watch-clock"));
      const until = async (fn, ms = 10_000) => {
        for (const t = Date.now(); Date.now() - t < ms; await new Promise((res) => setTimeout(res, 250))) if (await fn()) return true;
        return false;
      };
      // Someone's clock as the server keeps it now, in seconds.
      const serverClock = async (who, n) =>
        Number(
          (
            await pool.query(
              `SELECT (s.clock_ms + CASE WHEN s.running_since IS NULL THEN 0 ELSE extract(epoch FROM now() - s.running_since) * 1000 END) / 1000 AS at
                 FROM watch_sessions s WHERE s.started_by = $1 AND s.season_id = $2 AND s.episode = $3`,
              [U[who], sid, n]
            )
          ).rows[0]?.at ?? -1
        );
      const setTime = async (b, value) => {
        await b.pg.locator('[data-watch-nudge="time"]').click();
        await b.sheet().locator("[data-watch-time]").fill(value);
        await b.sheet().getByRole("button", { name: "Set" }).click();
        await b.sheet().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      };

      // Episode 6 back to three days off for sam's and riley's own time (alex's live night comes last).
      await pool.query("UPDATE show_seasons SET premiere_date = current_date + 3 - 35, air_time = '20:00' WHERE id = $1", [sid]);

      // ---------- sam: Episode 4, on his own time, with GIFs ----------
      const S = await browse(u("sam"), "sam", { "x-gys-gifs": gifs.url });
      const pg = S.pg;
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const cardEl = pg.locator('[data-watch-card="4"]');
      await cardEl.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const cardText = await cardEl.innerText();
      check((await cardEl.getAttribute("data-watch-status")) === "aired" && /Episode 4/i.test(cardText) && /zt_nd_riley and zt_nd_jordan left 5 reactions/.test(cardText), "Tonight's card: Episode 4, riley and jordan left 5 reactions", cardText);
      check((await pg.locator("[data-preview]").count()) === 0 || !(await pg.locator('[data-preview="show.watch-along"]').count()), "no Watch along Preview left on Tonight");
      await cardEl.scrollIntoViewIfNeeded();
      await cardEl.locator("img").evaluate((i) => i.complete || new Promise((r) => ((i.onload = r), (i.onerror = r)))).catch(() => {});
      await S.shot("tonight-card");
      await S.wide("Tonight");
      await cardEl.click();
      await pg.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(500);
      check(/page=watch/.test(pg.url()) && /ep=4/.test(pg.url()), "it opens over the show (?page=watch&ep=4)", pg.url());
      const startText = await pg.locator("[data-watch-start]").innerText();
      check(/Watch Episode 4/i.test(startText) && /with the couch/i.test(startText) && /left 5 reactions/.test(startText), "the start: Watch Episode 4 with the couch, who left reactions", startText);
      check((await pg.locator('[data-start="resume"]').count()) === 0, "nothing to pick up yet");
      await S.shot("start");
      await S.wide("the start");
      await pg.locator('[data-start="stream"]').click();
      await pg.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await pg.locator("[data-wake-lock]").waitFor({ timeout: 5000 }).catch(() => {});
      check((await pg.evaluate(() => window.__wake)).includes("screen") && (await pg.locator("[data-wake-lock]").count()) === 1, "Streaming: the clock starts and the screen stays on");
      check(await pg.locator("[data-gif-button]").waitFor({ timeout: 10_000 }).then(() => true, () => false), "GIFs set up: the GIF button");
      // Set the time: 1:40, where riley's 1:00 is 40 s behind.
      await pg.locator('[data-watch-nudge="time"]').click();
      await S.sheet().locator("[data-watch-time]").fill("1:40");
      await S.sheet().getByRole("button", { name: "Set" }).click();
      await pg.waitForFunction(() => /Kristin is SO calm/.test(document.querySelector("[data-watch-stream]")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
      const stream1 = await pg.locator("[data-watch-stream]").innerText();
      check(/zt: Kristin is SO calm/.test(stream1) && /zt: sam here/.test(stream1) && !/brutal/.test(stream1), "at 1:40: riley's 1:00 and his own 0:30, nothing later", stream1);
      check((await pg.locator("[data-pin]").count()) === 2, "two pins on the bar: the comments he's passed");
      check((await clockOf(pg)) >= 100, "the clock runs on from 1:40", String(await clockOf(pg)));
      await S.shot("stream");
      // riley's fire at 1:15 arrives on a poll once the clock passes 1:45.
      const fire = await pg.locator('[data-float="fire"]').waitFor({ state: "attached", timeout: 15_000 }).then(() => true, () => false);
      check(fire, "riley's fire (1:15) floats up once his clock passes 1:45");
      await pg.locator('[data-react="laugh"]').click();
      await pg.waitForTimeout(800);
      check((await said("sam")).some((x) => x.kind === "laugh" && x.episode === 4 && x.runtime_ms >= 100_000), "a laugh, pinned where his clock is");
      await pg.locator("[data-watch-say]").fill("zt: watching along");
      await pg.locator("[data-watch-say]").press("Enter");
      await pg.locator('[data-reaction="text"][data-mine="1"]:has-text("zt: watching along")').waitFor({ timeout: 10_000 });
      check((await said("sam")).some((x) => x.kind === "text" && x.text === "zt: watching along" && x.couch_id === A), "saying something: in the stream as you, kept on the couch");
      // A GIF from the stand-in.
      await pg.locator("[data-gif-button]").click();
      await S.sheet().locator("[data-gif-grid] [data-gif]").first().waitFor({ timeout: 10_000 });
      check((await S.sheet().locator("[data-gif]").count()) === fakeGifs.GIFS.length && /Powered by KLIPY/.test(await S.sheet().innerText()), "the GIF sheet: what's featured, Powered by KLIPY");
      await S.sheet().locator("[data-gif-search]").fill("plot");
      await pg.waitForFunction(() => document.querySelectorAll("[role=dialog][data-open] [data-gif]").length === 1, null, { timeout: 10_000 }).catch(() => {});
      await S.shot("gif-sheet");
      await S.sheet().locator("[data-gif]").first().click();
      await pg.locator('[data-reaction="gif"][data-mine="1"] img').waitFor({ timeout: 10_000 });
      check((await said("sam")).some((x) => x.kind === "gif" && x.gif?.id === fakeGifs.idOf("Plot twist")), "a GIF: Plot twist, kept with its picture");
      await pg.waitForTimeout(600);
      await S.shot("gif-sent");
      await S.wide("the watch along");
      // Take back his comment.
      await pg.locator('[data-reaction="text"][data-mine="1"]:has-text("zt: watching along") [data-take-back]').click();
      await pg.locator('[data-reaction="text"]:has-text("zt: watching along")').waitFor({ state: "detached", timeout: 10_000 });
      check(!(await said("sam")).some((x) => x.text === "zt: watching along"), "taken back: gone from the stream and the couch");
      // Pause, then on again.
      await pg.locator("[data-watch-pause]").click();
      const paused = await clockOf(pg);
      await pg.waitForTimeout(1600);
      check((await clockOf(pg)) === paused && /Paused/.test(await pg.locator(layer).innerText()), "Pause: the clock stands still", `${paused} → ${await clockOf(pg)}`);
      await pg.locator("[data-watch-pause]").click();
      await pg.waitForTimeout(1300);
      check((await clockOf(pg)) > paused, "Resume: it runs on");
      // −10 s jumps back.
      const before = await clockOf(pg);
      await pg.locator("[data-watch-back]").click();
      check((await clockOf(pg)) <= before - 9, "−10s", `${before} → ${await clockOf(pg)}`);
      // The bingo card comes with you.
      await pg.locator("[data-watch-bingo]").click();
      await S.sheet().waitFor({ timeout: 10_000 });
      check(/bingo/i.test(await S.sheet().innerText()), "Bingo opens his card over the watch along");
      await S.shot("bingo");
      await pg.keyboard.press("Escape");
      await S.sheet().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      // End: he plays it, so Reveal your scores first.
      await pg.locator('[data-watch-nudge="end"]').click();
      await pg.locator("[data-watch-end]").waitFor({ timeout: 5000 });
      check((await pg.locator("[data-watch-reveal]").count()) === 1 && (await pg.locator("[data-end-star]").count()) === 0, "End: How was Episode 4? Reveal your scores first (he plays it)", await pg.locator("[data-watch-end]").innerText());
      await S.shot("end-reveal");
      await pg.locator("[data-watch-keep]").click();
      await pg.locator("[data-watch-end]").waitFor({ state: "detached", timeout: 5000 });
      check(true, "Keep watching: back to the clock");
      // Close it, and come back: Pick up where he left off.
      await pg.locator(`${layer} button[aria-label="Close"]`).first().click();
      await pg.locator(layer).waitFor({ state: "detached", timeout: 10_000 });
      check(!/page=watch/.test(pg.url()) && (await pg.evaluate(() => window.__wake)).includes("released"), "Close: back to Tonight, the screen let go", pg.url());
      await cardEl.click();
      await pg.locator('[data-start="resume"]').waitFor({ timeout: 10_000 });
      check(/Pick up at 1:\d\d/.test(await pg.locator('[data-start="resume"]').innerText()), "opening it again: Pick up at where he was", await pg.locator('[data-start="resume"]').innerText());
      await S.shot("resume");
      const errs = S.errors();
      check(errs.length === 0, "sam: no page errors", errs.join(" | "));

      // ---------- riley: the Traitors (a show she only watches), no GIFs ----------
      const R = await browse(u("riley"), "riley", { "x-gys-gifs": "off" });
      const rp = R.pg;
      await rp.goto(`${BASE}/show/${tsid}/tonight`, { waitUntil: "load" });
      const tcard = rp.locator('[data-watch-card="3"]');
      await tcard.waitFor({ timeout: 30_000 });
      await rp.waitForTimeout(800);
      check(/Be the first/.test(await tcard.innerText()), "the Traitors' card: Episode 3, be the first (jordan watches privately)", await tcard.innerText());
      await tcard.click();
      await rp.locator('[data-start="stream"]').click();
      await rp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await rp.waitForTimeout(600);
      check((await rp.locator("[data-gif-button]").count()) === 0, "no GIFs set up: no GIF button");
      await rp.locator('[data-watch-nudge="end"]').click();
      await rp.locator("[data-watch-end]").waitFor({ timeout: 5000 });
      check(/Rating it marks Episode 3 seen/.test(await rp.locator("[data-watch-end]").innerText()), "End: her stars, and rating it marks Episode 3 seen");
      await R.shot("end-stars");
      await rp.locator('[data-end-star="4"]').click();
      await rp.locator('[data-rate-sheet="3"]').waitFor({ timeout: 15_000 });
      const mark = (await pool.query("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [U.riley, tsid])).rows[0]?.seen_through;
      const stars = (await pool.query("SELECT stars FROM episode_ratings WHERE user_id = $1 AND season_id = $2 AND episode = 3", [U.riley, tsid])).rows[0]?.stars;
      check(mark === 3 && stars === 4, "four stars: Episode 3 seen, rated, and the verdict sheet opens", `${mark} ${stars}`);
      await rp.waitForTimeout(500);
      await R.shot("rated");

      // ---------- part 2: riley and sam on Episode 4 at once ----------
      await rp.goto(`${BASE}/show/${sid}/tonight?page=watch&ep=4`, { waitUntil: "load" });
      await rp.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 30_000 });
      await rp.waitForTimeout(800);
      await rp.locator('[data-start="stream"]').click();
      await rp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await setTime(R, "2:20");
      check(await until(async () => (await serverClock("riley", 4)) >= 140), "riley starts Episode 4 and sets 2:20: her clock is kept on the server", String(await serverClock("riley", 4)));
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      await cardEl.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      check((await cardEl.getAttribute("data-watch-now")) === "1" && /zt_nd_riley is watching now/.test(await cardEl.innerText()), "sam's Tonight card: riley is watching now", await cardEl.innerText());
      await cardEl.click();
      await pg.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
      await pg.locator("[data-watch-left]").waitFor({ timeout: 10_000 });
      const startNow = await pg.locator("[data-watch-left]").innerText();
      check(/zt_nd_riley is on now · 1 watched earlier/.test(startNow), "the start: riley is on now · 1 watched earlier (jordan)", startNow);
      check((await pg.locator('[data-start="join-live"]').count()) === 0, "Episode 4 isn't on air: no Join the live airing");
      await S.shot("start-riley-on");
      await pg.locator('[data-start="stream"]').click();
      await pg.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await setTime(S, "1:40");
      const near = pg.locator("[data-watch-near]");
      await near.waitFor({ timeout: 10_000 });
      await pg.waitForTimeout(600);
      const nearText = await near.innerText();
      const ahead = Number((/zt_nd_riley is watching now · (\d+)s ahead/.exec(nearText) || [])[1]);
      check(ahead >= 35 && ahead <= 90, "sam at 1:40: riley is watching now · 40-odd seconds ahead", nearText);
      const marks = await pg.evaluate(() => {
        const left = (el) => parseFloat(el?.style.left ?? "NaN");
        return { riley: left(document.querySelector('[data-who="zt_nd_riley"]')), count: document.querySelectorAll("[data-who]").length };
      });
      check(marks.count === 1 && marks.riley > (100 / (90 * 60)) * 100, "her mark on his bar, ahead of his", JSON.stringify(marks));
      await S.shot("riley-on-the-bar");
      await S.wide("the watch along with riley on");
      await pg.locator('[data-watch-catch-up="zt_nd_riley"]').click();
      await pg.waitForTimeout(400);
      const caught = Math.abs((await clockOf(pg)) - (await serverClock("riley", 4)));
      check(caught <= 3 && /with you/.test(await near.innerText()), "Catch up: his clock to hers, with you", `${caught}s apart · ${await near.innerText()}`);
      check(await until(async () => Math.abs((await serverClock("sam", 4)) - (await serverClock("riley", 4))) <= 3), "and the server keeps his where hers is");
      // riley pauses: on sam's next poll she's paused; riley's own bar has sam on it.
      await rp.locator("[data-watch-pause]").click();
      check(await until(async () => /paused/.test(await near.innerText()), 12_000), "riley pauses: sam's line says so on his next poll", await near.innerText());
      check(await until(async () => (await rp.locator('[data-who="zt_nd_sam"]').count()) === 1, 25_000), "riley's bar has sam on it too");
      await R.shot("paused-sam-on");
      // riley closes hers: gone from sam's at his next poll.
      await rp.locator(`${layer} button[aria-label="Close"]`).first().click();
      await rp.locator(layer).waitFor({ state: "detached", timeout: 10_000 });
      check(await until(async () => (await near.count()) === 0, 12_000), "riley closes hers: off sam's watch along by his next poll");
      await pg.locator(`${layer} button[aria-label="Close"]`).first().click();
      await pg.locator(layer).waitFor({ state: "detached", timeout: 10_000 });
      check(await until(async () => (await pool.query("SELECT 1 FROM watch_session_people WHERE user_id = $1 AND left_at IS NULL", [U.sam])).rowCount === 0), "and sam's closed: nobody's left on now");
      check(S.errors().length === 0, "sam (part 2): no page errors", S.errors().join(" | "));
      check(R.errors().length === 0, "riley: no page errors", R.errors().join(" | "));

      // ---------- alex: Episode 6 on air, and the hub's ways in ----------
      await onAir();
      const X1 = await browse(u("alex"), "alex");
      const xp = X1.pg;
      await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const live = xp.locator('[data-watch-card="6"][data-watch-status="live"]');
      await live.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(800);
      check(/On air · Episode 6/i.test(await live.innerText()) && /zt_nd_riley left 1 reaction/.test(await live.innerText()), "Tonight: On air · Episode 6, riley left 1 reaction", await live.innerText());
      const movesAt = await xp.getByText(/^Your moves$/i).first().boundingBox().catch(() => null);
      const liveAt = await live.boundingBox();
      check(!!liveAt && (!movesAt || liveAt.y < movesAt.y) && (await xp.locator("[data-watch-card]").count()) === 1, "on air it leads Tonight (above Your moves), once", `${liveAt?.y} vs ${movesAt?.y}`);
      await live.locator("img").evaluate((i) => i.complete || new Promise((r) => ((i.onload = r), (i.onerror = r)))).catch(() => {});
      await X1.shot("tonight-live");
      await live.click();
      const join = xp.locator('[data-start="join-live"]');
      await join.waitFor({ timeout: 10_000 });
      const joinText = await join.innerText();
      const fromAir = /About (\d+):(\d\d) in, from airtime/.exec(joinText);
      const airedSecs = Number((await pool.query("SELECT extract(epoch FROM now() - ((premiere_date + 35 + air_time) AT TIME ZONE air_tz)) AS s FROM show_seasons WHERE id = $1", [sid])).rows[0].s);
      const shownSecs = fromAir ? Number(fromAir[1]) * 60 + Number(fromAir[2]) : -1;
      check(shownSecs > 0.6 * airedSecs && shownSecs < airedSecs && /Join the live airing/.test(joinText), "on air with nobody live on the couch: Join the live airing, from airtime, a touch behind", `${joinText} (${Math.round(airedSecs)}s since airtime)`);
      await X1.shot("join-live");
      await xp.locator('[data-start="live"]').click();
      await xp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      check((await xp.locator("[data-watch-ad]").count()) === 1, "Live on TV: an Ad break button");
      await xp.locator("[data-watch-ad]").click();
      const atAd = await clockOf(xp);
      await xp.waitForTimeout(1300);
      check((await xp.locator("[data-watch-ad]").getAttribute("aria-pressed")) === "true" && (await clockOf(xp)) === atAd && /Ad break/.test(await xp.locator(layer).innerText()), "Ad break: the clock waits");
      await X1.shot("ad-break");
      await xp.locator("[data-watch-ad]").click();
      await xp.locator("[data-watch-say]").fill("zt: live from the couch");
      await xp.locator("[data-watch-say]").press("Enter");
      await xp.locator('[data-reaction="text"][data-mine="1"]').waitFor({ timeout: 10_000 });
      check((await said("alex")).some((x) => x.episode === 6 && x.text === "zt: live from the couch"), "saying something live: kept on Episode 6");
      // Move the clock to 4:40: riley's 4:00 has reached him.
      await xp.locator('[data-watch-nudge="time"]').click();
      await X1.sheet().locator("[data-watch-time]").fill("4:40");
      await X1.sheet().getByRole("button", { name: "Set" }).click();
      await xp.waitForFunction(() => /live and loving it/.test(document.querySelector("[data-watch-stream]")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
      check(/live and loving it/.test(await xp.locator("[data-watch-stream]").innerText()), "at 4:40, riley's 4:00");
      await X1.shot("live");
      await X1.wide("the live watch along");
      // riley joins the live airing, in step with alex.
      await rp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const rLive = rp.locator('[data-watch-card="6"][data-watch-status="live"]');
      await rLive.waitFor({ timeout: 30_000 });
      await rp.waitForTimeout(800);
      check(/zt_nd_alex is watching · your bingo card comes with you/.test(await rLive.innerText()), "riley's Tonight: alex is watching the live airing", await rLive.innerText());
      await rLive.click();
      const rJoin = rp.locator('[data-start="join-live"]');
      await rJoin.waitFor({ timeout: 10_000 });
      check(/In step with zt_nd_alex · \d+:\d\d in/.test(await rJoin.innerText()), "her start: Join the live airing, in step with alex", await rJoin.innerText());
      await R.shot("join-with-alex");
      await rJoin.click();
      await rp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await rp.waitForTimeout(600);
      const apart = Math.abs((await clockOf(rp)) - (await serverClock("alex", 6)));
      check(apart <= 4 && (await rp.locator("[data-watch-ad]").count()) === 1, "joined: live TV, her clock where alex's is", `${apart}s apart`);
      await rp.locator("[data-watch-near]").waitFor({ timeout: 10_000 });
      check(/zt_nd_alex is watching now · with you/.test(await rp.locator("[data-watch-near]").innerText()), "riley: alex is watching now · with you", await rp.locator("[data-watch-near]").innerText());
      await R.shot("joined-live");
      // The hub: Up next's Watch along.
      await xp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const upWatch = xp.locator("[data-upnext-watch]");
      await upWatch.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(800);
      check((await xp.locator('[data-preview="hub.watch-along"]').count()) === 0, "the hub: no Watch along Preview left");
      const onNowEl = xp.locator('[data-on-now="zt_nd_riley"]');
      await onNowEl.waitFor({ timeout: 10_000 }).catch(() => {});
      const onNowText = (await onNowEl.count()) ? await onNowEl.innerText() : "";
      check(/zt_nd_riley is watching ZT Survivor/.test(onNowText) && /Live · Episode 6/.test(onNowText) && /Watch along/i.test(onNowText) && (await xp.locator('[data-preview="hub.on-now"]').count()) === 0, "the hub's On now (real): riley is watching ZT Survivor · Live · Episode 6", onNowText);
      await X1.shot("hub-on-now");
      await onNowEl.click();
      await xp.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
      check(/ep=6/.test(xp.url()) && /In step with zt_nd_riley/.test(await xp.locator('[data-start="join-live"]').innerText()), "On now opens his watch along of Episode 6: join it in step with riley", xp.url());
      await xp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      await upWatch.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(800);
      await upWatch.click();
      await xp.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
      check(xp.url().includes(`/show/${sid}/tonight`) && /page=watch/.test(xp.url()), "Up next's Watch along: the show, its watch along open", xp.url());
      // Previously on's.
      await xp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const prev = xp.locator('[data-more="previously"] button');
      await prev.waitFor({ timeout: 30_000 });
      await prev.scrollIntoViewIfNeeded();
      await prev.click();
      const poWatch = xp.locator(`[data-previously="${sid}"] [data-po-watch]`);
      await poWatch.waitFor({ timeout: 20_000 }).catch(() => {});
      if (!(await poWatch.count())) {
        // Previously on opens on one of your shows: pick Survivor's.
        await xp.locator(`[data-po-show="${sid}"], [data-show-pick="${sid}"]`).first().click().catch(() => {});
        await poWatch.waitFor({ timeout: 10_000 }).catch(() => {});
      }
      check((await poWatch.count()) === 1 && /Watch along · Episode 6/.test(await poWatch.innerText()), "Previously on: Watch along · Episode 6");
      if (await poWatch.count()) {
        await poWatch.scrollIntoViewIfNeeded();
        await X1.shot("previously-on");
        await poWatch.click();
        await xp.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
        check(/page=watch/.test(xp.url()), "and it opens the watch along");
      }
      // riley moves to the Traitors (a show alex doesn't follow): On now and The couch is watching say so.
      await rp.goto(`${BASE}/show/${tsid}/tonight?page=watch&ep=3`, { waitUntil: "load" });
      await rp.locator('[data-start="stream"]').click();
      await rp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      check(await until(async () => (await pool.query("SELECT 1 FROM watch_sessions WHERE started_by = $1 AND season_id = $2", [U.riley, tsid])).rowCount === 1), "riley opens the Traitors' Episode 3");
      await xp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const tw = xp.locator("[data-couch-watching] [data-watched-on]");
      await tw.first().waitFor({ timeout: 30_000 }).catch(() => {});
      await xp.waitForTimeout(800);
      const onT = (await xp.locator('[data-on-now="zt_nd_riley"]').count()) ? await xp.locator('[data-on-now="zt_nd_riley"]').innerText() : "";
      check(/watching ZT Traitors/.test(onT) && /Have a look/i.test(onT), "On now: riley is watching ZT Traitors (not his: Have a look)", onT);
      check((await tw.count()) === 1 && /zt_nd_riley is on/i.test(await tw.innerText()) && /zt_nd_riley · now/.test(await xp.locator("[data-couch-watching]").innerText()), "The couch is watching: the Traitors with riley is on, and riley · now", await xp.locator("[data-couch-watching]").innerText());
      await tw.scrollIntoViewIfNeeded();
      await xp.locator("[data-couch-watching] img").first().evaluate((i) => i.complete || new Promise((r) => ((i.onload = r), (i.onerror = r)))).catch(() => {});
      await X1.shot("couch-watching-on");
      await rp.locator(`${layer} button[aria-label="Close"]`).first().click();
      check(R.errors().length === 0, "riley (part 2): no page errors", R.errors().join(" | "));
      check(X1.errors().length === 0, "alex: no page errors", X1.errors().join(" | "));

      // ---------- part 3: three at once in one together session (sam's shared start of Episode 4) ----------
      await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [U.sam, sid]);
      await pool.query("UPDATE show_follows SET seen_through = 5 WHERE user_id = ANY($1::text[]) AND season_id = $2", [[U.riley, U.jordan, U.alex], sid]);
      await pool.query("DELETE FROM watch_plans WHERE couch_id = $1", [A]);
      await pool.query("DELETE FROM watch_sessions WHERE season_id = ANY($1::uuid[])", [[sid, tsid]]);
      r = await planNight("sam", { episode: 4, how: "start", startsAt: new Date(Date.now() + 5 * MIN).toISOString(), invite: [U.riley, U.jordan] });
      const bn = r.body.plan;
      check(r.status === 200 && !!bn?.id, "sam plans Episode 4 together, five minutes from now");
      const sessionNow = async () => (await pool.query("SELECT * FROM watch_sessions WHERE plan_id = $1", [bn.id])).rows[0];

      // sam: his plate's Open.
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const sPlate = pg.locator(`[data-plan="${bn.id}"]`);
      await sPlate.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      check((await sPlate.locator("[data-plan-together]").count()) === 1 && (await pg.locator('[data-preview="show.watch-together"]').count()) === 0, "sam's plate: Open (real: no Preview)");
      await sPlate.locator("[data-plan-together]").click();
      const sStart = pg.locator("[data-together-start='ready']");
      await sStart.waitFor({ timeout: 20_000 });
      check(/plan=/.test(pg.url()) && /ep=4/.test(pg.url()), "it opens the night's watch along (?page=watch&ep=4&plan=)", pg.url());
      const sStartText = await sStart.innerText();
      check(/Watching\s+together/i.test(sStartText) && /Start at the same time/.test(sStartText) && /3, 2, 1 for everyone in it/.test(sStartText) && /Anyone can pause for everyone/.test(sStartText), "the start: Watching together, Start at the same time · 3, 2, 1", sStartText);
      check(await until(async () => !!(await sessionNow())), "opening it (due) joined it: a session");
      await S.shot("together-start");
      await S.wide("the together start");

      // riley: I'm in on her plate, then Open.
      const RT = R;
      const rp3 = rp;
      await rp3.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const rPlate = rp3.locator(`[data-plan="${bn.id}"]`);
      await rPlate.waitFor({ timeout: 30_000 });
      await rp3.waitForTimeout(800);
      await rPlate.locator("[data-plan-in]").click();
      await rPlate.locator("[data-plan-together]").waitFor({ timeout: 10_000 });
      await rPlate.locator("[data-plan-together]").click();
      await rp3.locator("[data-together-start='ready']").waitFor({ timeout: 20_000 });
      await rp3.locator("[data-watch-here]").waitFor();
      check(await until(async () => /zt_nd_sam is here/.test(await rp3.locator("[data-watch-here]").innerText())), "riley: I'm in, then Open: zt_nd_sam is here", await rp3.locator("[data-watch-here]").innerText());

      // jordan: the hub's Up next, Watch along · 2 going, Join.
      const JT = await browse(u("jordan"), "jordan3");
      const jp = JT.pg;
      await jp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const upPlan = jp.locator(`[data-upnext-plan="${bn.id}"]`);
      await upPlan.waitFor({ timeout: 30_000 }).catch(() => {});
      await jp.waitForTimeout(800);
      const upText = (await upPlan.count()) ? await upPlan.innerText() : "";
      check(/Watch along · 2 going/.test(upText) && /Ep 4/.test(upText) && /starting together/.test(upText) && (await jp.locator("[data-upnext-watch]").count()) === 0, "jordan's Up next: Watch along · 2 going (Episode 4, starting together) in Watch along's place", upText);
      check((await upPlan.locator("[data-upnext-join='join']").count()) === 1, "with Join (he hasn't said)");
      if (await upPlan.count()) {
        await upPlan.scrollIntoViewIfNeeded();
        await JT.shot("upnext-planned");
        await JT.wide("Up next with a planned night");
        await upPlan.locator("[data-upnext-join]").click();
      }
      await jp.locator("[data-together-start='ready']").waitFor({ timeout: 30_000 });
      check(/plan=/.test(jp.url()) && (await pool.query("SELECT answer FROM watch_plan_people WHERE plan_id = $1 AND user_id = $2", [bn.id, U.jordan])).rows[0]?.answer === "in", "Join: he's in, and the night's watch along opens (it's due)", jp.url());
      check(await until(async () => /zt_nd_sam and zt_nd_riley are here/.test(await pg.locator("[data-watch-here]").innerText()) || /zt_nd_riley and zt_nd_jordan are here/.test(await pg.locator("[data-watch-here]").innerText()), 15_000), "sam's start: the others are here", await pg.locator("[data-watch-here]").innerText());
      await S.shot("together-start-here");

      // sam starts it: 3, 2, 1 for all three.
      await pg.locator('[data-start="together-start"]').click();
      await pg.locator("[data-watch-countdown]").waitFor({ timeout: 5000 }).catch(() => {});
      check((await pg.locator("[data-watch-countdown]").count()) === 1, "sam: the countdown");
      await S.shot("countdown");
      const pulled = await until(async () => (await rp3.locator("[data-together-start]").count()) === 0 && (await jp.locator("[data-together-start]").count()) === 0, 8000);
      check(pulled, "riley's and jordan's starts give way: pulled into the countdown");
      check(await until(async () => (await clockOf(pg)) >= 2 && (await clockOf(rp3)) >= 1 && (await clockOf(jp)) >= 1, 15_000), "the clocks run");
      const spread = async () => {
        const cs = [await clockOf(pg), await clockOf(rp3), await clockOf(jp)];
        return Math.max(...cs) - Math.min(...cs);
      };
      check((await spread()) <= 2, "all three together, within a couple of seconds", String(await spread()));
      check(/Watch along · zt_nd_riley and zt_nd_jordan/.test(await pg.locator("[data-watch-top]").innerText()) || /Watch along · zt_nd_jordan and zt_nd_riley/.test(await pg.locator("[data-watch-top]").innerText()), "sam's top line: Watch along · riley and jordan", await pg.locator("[data-watch-top]").innerText());
      check(/Pause\s+for everyone/.test(await pg.locator("[data-watch-pause]").innerText()), "Pause for everyone");
      await pg.waitForFunction(() => /are here/.test(document.querySelector("[data-watch-together]")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
      check(/Watching together · zt_nd_\w+ and zt_nd_\w+ are here/.test(await pg.locator("[data-watch-together]").innerText()), "the line: Watching together · riley and jordan are here", await pg.locator("[data-watch-together]").innerText());
      await S.shot("together-on");
      await S.wide("watching together");

      // riley pauses for everyone.
      await rp3.locator("[data-watch-pause]").click();
      const stoppedFor = async (page) => {
        const a = await clockOf(page);
        await page.waitForTimeout(1200);
        return (await clockOf(page)) === a && (await page.locator("[data-watch-together-bar='pause']").count()) === 1;
      };
      check(await until(() => stoppedFor(pg), 12_000), "sam's clock stops (riley paused it)");
      check(await until(() => stoppedFor(jp), 12_000), "and jordan's");
      const bar = await pg.locator("[data-watch-together-bar]").innerText();
      check(/zt_nd_riley paused for everyone/.test(bar) && /Resume for everyone/.test(bar), "sam's bar: riley paused for everyone · Resume for everyone", bar);
      check(/You paused for everyone/.test(await rp3.locator("[data-watch-together-bar]").innerText()) && (await rp3.locator("[data-watch-resume-all]").count()) === 0, "riley's own: You paused for everyone");
      check(Math.abs((await clockOf(pg)) - (await clockOf(rp3))) <= 1, "stopped where she stopped it", `${await clockOf(pg)} ${await clockOf(rp3)}`);
      await S.shot("paused-for-everyone");
      // jordan resumes it for everyone, from the bar.
      await jp.locator("[data-watch-resume-all]").click();
      const runsOn = async (page) => {
        const a = await clockOf(page);
        await page.waitForTimeout(1500);
        return (await clockOf(page)) > a;
      };
      check(await until(() => runsOn(pg), 12_000) && (await until(() => runsOn(rp3), 12_000)), "jordan resumes it: sam's and riley's clocks run again");
      check(await until(async () => /zt_nd_jordan resumed it for everyone/.test((await pg.locator("[data-watch-together-bar]").count()) ? await pg.locator("[data-watch-together-bar]").innerText() : ""), 8000), "sam's bar says who");

      // riley says something: sam has it at once (not 30 s later).
      const saidAt = Date.now();
      await rp3.locator("[data-watch-say]").fill("zt: right here with you");
      await rp3.locator("[data-watch-say]").press("Enter");
      const heard = await pg.waitForFunction(() => /right here with you/.test(document.querySelector("[data-watch-stream]")?.textContent ?? ""), null, { timeout: 20_000 }).then(() => true, () => false);
      check(heard && Date.now() - saidAt < 15_000, "riley says something: sam has it within a poll or two", `${Date.now() - saidAt} ms`);
      check(/What the people here say shows up as you reach it/.test(await pg.locator(layer).innerText()), "and the screen says so");

      // Bingo: sam's tick on riley's card.
      await rp3.locator("[data-watch-bingo]").click();
      await RT.sheet().locator("[data-bingo-card]").waitFor({ timeout: 15_000 });
      await pg.locator("[data-watch-bingo]").click();
      await S.sheet().locator("[data-bingo-card]").waitFor({ timeout: 15_000 });
      // Cards are dealt each their own: sam ticks a moment riley's card has too (if any), so his face lands on one of hers.
      const rileyLabels = await RT.sheet().locator("[data-square]:not([disabled])").allInnerTexts();
      const samSquaresEl = S.sheet().locator("[data-square]:not([disabled])");
      const samLabels = await samSquaresEl.allInnerTexts();
      const shared = samLabels.findIndex((l) => rileyLabels.includes(l));
      const tickEl = samSquaresEl.nth(Math.max(0, shared));
      const tickLabel = await tickEl.innerText();
      await tickEl.click();
      const onRiley = await until(async () => (await RT.sheet().locator("[data-bingo-together]").count()) === 1, 15_000);
      check(onRiley && /zt_nd_sam ticked 1/.test(await RT.sheet().locator("[data-bingo-together]").innerText()), "sam ticks a square: riley's open card says so (sam ticked 1)", tickLabel);
      if (shared >= 0) check((await RT.sheet().locator('[data-square-mates*="zt_nd_sam"]').count()) === 1, "his face on the same moment of her card", tickLabel);
      await RT.sheet().locator("[data-bingo-card]").scrollIntoViewIfNeeded();
      await RT.shot("bingo-together");
      await rp3.keyboard.press("Escape");
      await pg.keyboard.press("Escape");
      await RT.sheet().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      await S.sheet().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});

      // riley closes it: sam's line says so.
      await rp3.locator(`${layer} button[aria-label="Close"]`).first().click();
      check(await until(async () => /Watching together · zt_nd_jordan is here/.test(await pg.locator("[data-watch-together]").innerText()), 12_000), "riley closes it: sam's line, jordan is here", await pg.locator("[data-watch-together]").innerText());
      const people = (await pool.query("SELECT user_id, left_at FROM watch_session_people WHERE session_id = $1", [(await sessionNow()).id])).rows;
      check(people.length === 3 && !!people.find((x) => x.user_id === U.riley)?.left_at && (await sessionNow()).running_since, "on the server: riley left, the clock runs on", JSON.stringify(people));

      // alex, late: the plan's sheet, I'm in, Open the watch along, Join them where it is.
      await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const aPlate = xp.locator(`[data-plan="${bn.id}"]`);
      await aPlate.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(800);
      await aPlate.locator("[data-plan-open]").click();
      await X1.sheet().locator("[data-plan-yes]").click();
      await X1.sheet().locator("[data-plan-watch]").waitFor({ timeout: 10_000 });
      await X1.sheet().locator("[data-plan-watch]").click();
      const going = xp.locator("[data-together-start='going']");
      await going.waitFor({ timeout: 20_000 });
      const lateText = await xp.locator('[data-start="together-join"]').innerText();
      check(/Join them · \d+:\d\d in/.test(lateText) && (await xp.locator('[data-start="together-own"]').count()) === 1, "alex, late: Join them where it is, or from the start on his own", lateText);
      check(/zt_nd_sam and zt_nd_jordan are watching/.test(await going.innerText()), "the start says who's watching", await going.innerText());
      await X1.shot("together-late");
      await xp.locator('[data-start="together-join"]').click();
      await xp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      check(await until(async () => Math.abs((await clockOf(xp)) - (await clockOf(pg))) <= 2, 8000), "joined: his clock with sam's", `${await clockOf(xp)} ${await clockOf(pg)}`);
      for (const [b, who] of [[S, "sam (part 3)"], [RT, "riley (part 3)"], [JT, "jordan"], [X1, "alex (part 3)"]]) check(b.errors().length === 0, `${who}: no page errors`, b.errors().join(" | "));
      for (const page of [pg, jp, xp]) await page.locator(`${layer} button[aria-label="Close"]`).first().click().catch(() => {});
      await pool.query("DELETE FROM watch_plans WHERE couch_id = $1", [A]);

      // ---------- zt_so_sam (on 3, no couch): the solo hub ----------
      const SO = await browse(soloFixture.username("sam"), "solo");
      const sp = SO.pg;
      await sp.goto(`${BASE}/home`, { waitUntil: "load" });
      const tile = sp.locator("[data-solo-watch]");
      await tile.waitFor({ timeout: 30_000 });
      await sp.waitForTimeout(800);
      check((await sp.locator('[data-preview="hub.watch-along"]').count()) === 0, "the solo hub's Watch along is real");
      await tile.scrollIntoViewIfNeeded();
      await SO.shot("solo-hub");
      const soloSeason = await tile.getAttribute("data-solo-watch");
      await tile.click();
      await sp.locator(`${layer} [data-watch-start]`).waitFor({ timeout: 20_000 });
      check(sp.url().includes(`/show/${soloSeason}/tonight`) && /your way/i.test(await sp.locator("[data-watch-start]").innerText()), "it opens the show's watch along, your way (no couch)");
      await sp.locator('[data-start="stream"]').click();
      await sp.locator("[data-watch-start]").waitFor({ state: "detached", timeout: 5000 });
      await sp.locator("[data-watch-scope]").waitFor({ timeout: 10_000 }).catch(() => {});
      check(/Just you/.test(await sp.locator(layer).innerText()), "alone: what you say stays yours");
      await SO.shot("solo-watch");
      check(SO.errors().length === 0, "zt_so_sam: no page errors", SO.errors().join(" | "));
    }
    void so;
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e.stack || e.message);
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await soloFixture.down(pool).catch((e) => console.log("solo-fixture down:", e.message));
      await fixture.down(pool).catch((e) => console.log("new-fixture down:", e.message));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
