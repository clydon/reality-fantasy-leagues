// Dev-only check for Watch along (docs/PLAN-new-design.md step 13), against the dev server, on new-fixture.js's couch ("ZT Survivor
// 51": alex, riley, jordan and sam play it, results through Episode 5, everyone on 5 but sam on 3, Episode 6 three days off; ZT
// Traitors, which riley follows openly through 2 and jordan privately through 4; casey is only on alex's other couch, ZT Extra) and
// solo-fixture.js (people on no couch). It grows with the step's parts; part 1 is watch along on your own time (watch-along.ts):
//   API:
//   - Tonight's card (GET /api/seasons/[id]/watch): sam's next episode (4, aired) with who on the couch left reactions there and how
//     many, alex's next to air (6, "soon": nothing in it);
//   - the refusals: an episode past your next (sam's 5, alex's 7: 403), saying something before an episode airs (409), a couch
//     you're not on (404), not a season (404), not an episode (400), a comment that's empty or too long, a kind that isn't one, a
//     GIF with no GIFs set up (409) or not GIPHY's (400), a moment that hasn't aired, too many at once (429);
//   - what reaches whom: the couch's reactions only 30 s after their moment (riley's at 1:00 reaches sam at 1:30, not 1:29.999),
//     yours at once, what's new since a moment, the pins and the couch's count on opening, a private watcher's (jordan's Traitors)
//     reaching nobody, another couch's (ZT Extra) never, alone (no couch) only yours, taking one back;
//   - an episode on air (Episode 6 moved to have started ten minutes ago): the card says live, nothing past what's aired reaches
//     anyone or can be said, sam (behind) can't watch it;
//   - GIFs: none without GIPHY_API_KEY or the stand-in (fake-gifs.js, `x-gys-gifs`), trending and a search with it.
//   In a real browser at --width (390 by default): as sam (with the stand-in's GIFs and a wake lock stand-in), Tonight's card,
//   the start, the screen kept on, Set the time, the couch's comments 30 s late and their pins, a reaction arriving on the poll,
//   reacting, saying something, a GIF, taking one back, pause, the bingo card, End with Reveal your scores, closing and picking up
//   where he left off; as riley (no GIFs: no button), the Traitors (a show she only watches): End, four stars marking Episode 3
//   seen and opening the verdict; as alex, Episode 6 on air (Live TV, Ad break, saying something), Up next's and Previously on's
//   Watch along on the hub; as zt_so_sam (solo, on 3), the solo hub's Watch along. Nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-watch-along.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and solo-fixture.js up and takes them down (--keep leaves them); touches zt
// rows only; refuses a non-local database, and a GIPHY_API_KEY in .env.local (it would answer instead of the stand-in). Prints
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
if (process.env.GIPHY_API_KEY) throw new Error("check-new-watch-along needs GIPHY_API_KEY unset (the stand-in answers instead)");

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
      as[who] = await api({ user: u(who), pass: PASSWORD });
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
      [{ at: 1000, kind: "gif", gif: { id: "zt1", url: "https://media.giphy.com/media/zt1/200w.gif", w: 200, h: 150 } }, 409, /GIFs aren't on/, "a GIF with no GIFs set up"],
    ]) {
      r = await say("riley", 4, body);
      check(r.status === status && re.test(r.body.error), `${what}: ${status}`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await say("riley", 4, { at: 1000, kind: "gif", gif: { id: "zt1", url: "https://evil.example/zt1.gif", w: 200, h: 150 } }, { gifs: true });
    check(r.status === 400 && /GIPHY/.test(r.body.error), "a GIF that isn't GIPHY's (or the stand-in's): 400", JSON.stringify(r.body));
    check((await said("riley")).length === 0, "and nothing was kept");

    // ---------- GIFs ----------
    r = await as.riley.call("GET", "/api/gifs");
    check(r.status === 404, "GIFs with no key: 404 (and the watch along says gifs: false)");
    r = await withGifs.riley.call("GET", "/api/gifs");
    check(r.status === 200 && r.body.gifs.length === fakeGifs.GIFS.length && r.body.gifs.every((g) => g.url.startsWith(gifs.url) && g.preview && g.w === 200), "the stand-in: what's trending, each with its picture and a smaller one", JSON.stringify(r.body).slice(0, 200));
    r = await withGifs.riley.call("GET", "/api/gifs?q=clap");
    check(r.status === 200 && r.body.gifs.length === 1 && r.body.gifs[0].title === "Slow clap GIF", "a search: Slow clap");
    const clap = r.body.gifs[0];
    check(gifs.asked.some((a) => a.startsWith("/v1/gifs/search") && /q=clap/.test(a) && /rating=pg-13/.test(a)), "asked GIPHY's search, PG-13 at most");
    gifs.down = true;
    r = await withGifs.riley.call("GET", "/api/gifs?q=nope");
    check(r.status === 503, "GIPHY not answering: 503");
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
    check(r.body.through >= 9 * MIN && r.body.through < 10 * MIN, "a clock ahead of the airing: only what's aired, 30 s back", String(r.body.through));
    r = await read("sam", 6, 0);
    check(r.status === 403, "sam (behind) can't watch along it");

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
      check((await S.sheet().locator("[data-gif]").count()) === fakeGifs.GIFS.length && /Powered by GIPHY/.test(await S.sheet().innerText()), "the GIF sheet: what's trending, Powered by GIPHY");
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
      const R = await browse(u("riley"), "riley");
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
      // The hub: Up next's Watch along.
      await xp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const upWatch = xp.locator("[data-upnext-watch]");
      await upWatch.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(800);
      check((await xp.locator('[data-preview="hub.watch-along"]').count()) === 0, "the hub: no Watch along Preview left");
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
      check(X1.errors().length === 0, "alex: no page errors", X1.errors().join(" | "));

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
