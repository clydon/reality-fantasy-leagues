// Dev-only check for React with a GIF (docs/PLAN-gif-reactions.md; migration 0162 episode_gifs, episode-gifs.ts, src/new/show/react.tsx),
// in place of Rate it's stars (shelved 2026-11-01), against the dev server, on new-fixture.js's couch ("ZT Survivor 51": alex, riley,
// jordan and sam play it, results through Episode 5, everyone on 5 but sam on 3; ZT Traitors, which riley follows openly through 2 and
// jordan privately through 4; casey is only on alex's other couch, ZT Extra) and solo-fixture.js (people on no couch). GIFs come from
// fake-gifs.js, the KLIPY stand-in, through the `x-gys-gifs` header (next dev only):
//   API (GET/POST /api/seasons/[id]/gifs/[n]?couch=):
//   - alex posts one for Episode 5 and reads it back as `mine`; riley and jordan post theirs and alex's read lists both in `people`
//     (never him), `of` the couch's people who share the show; changing yours keeps one; `search` says whether GIFs are on;
//   - the guard: sam (on 3) is refused Episode 4 and 5 (403, read or post) and posts for 3; alex can't post for 6 (unseen, 403);
//     someone who sees everything straight away (casey) can't post for an episode that hasn't aired (409);
//   - the refusals: no gif key (400), a GIF from anywhere but KLIPY (400), GIFs off (`x-gys-gifs: off`, 400), not an episode (400),
//     not a season (404), a couch you're not on (404); `{ gif: null }` takes yours back;
//   - what's shared: riley turns My episode GIFs off (the profile's `sharing: { gifs }`, as check-new-sharing.js does) and hers
//     leaves alex's read, `of` and the Episodes count, then comes back; jordan's on the Traitors (watched privately) reaches nobody;
//     another couch's (casey on ZT Extra) only that couch; with no couch, and solo (zt_so_ people), only yours, `of` 0;
//   - the Episodes read: Episode 5's `gifs` (how many, yours among them, up to three pictures, yours first), nothing on the
//     episodes sam hasn't seen;
//   - Couch points: a GIF counts as the "rating" kind (2 points; the hub's rankings), once an episode however often it's changed.
//   In a real browser at --width (390 by default), with the stand-in:
//   - as alex: Tonight's Extras row (reacted), its sheet (yours, the couch's tiles, "3 of 4"), Pick another, the picker (KLIPY's
//     featured), a search and a tap (posted, the new one kept); Episodes' stack and the episode page's row;
//   - as sam (behind): Tonight's row for Episode 3 says React, nothing for 4 or 5, the picker opens and a tap posts;
//   - the reveal: alex set back to Episode 4 with his GIF for 5 taken away reveals Episode 5 from Tonight; the couch's GIFs slide
//     ([data-beat="gifs"]) comes right after who went home and before the lineup, the games and the table, with riley's and
//     jordan's tiles and "Yours goes here"; Add your GIF opens the sheet over the reveal, a tap posts, and the slide shows yours.
//   Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; BASE= for a lane's server)
//   node scripts/dev-test/check-gif-reactions.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js and solo-fixture.js up and takes them down (--keep leaves them); touches zt rows
// only; needs no KLIPY key (a KLIPY_API_KEY in .env.local is fine); refuses a non-local database. Prints PASS/FAIL; exits 1 on a
// failure.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const soloFixture = require("./solo-fixture");
const fakeGifs = require("./fake-gifs");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-gif-reactions runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-gif-reactions.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;

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
    const gifs = await fakeGifs.start();
    closers.push(gifs.close);
    const fx = await fixture.up(pool);
    const so = await soloFixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    const A = fx.couchId;
    const X = fx.extraCouchId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);

    const stand = { "x-gys-gifs": gifs.url };
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: u(who), pass: PASSWORD, headers: stand });
    const alexOff = await api({ user: u("alex"), pass: PASSWORD, headers: { "x-gys-gifs": "off" } });
    const q = (couch) => (couch ? `?couch=${couch}` : "");
    const read = (who, n, couch = A, season = sid) => as[who].call("GET", `/api/seasons/${season}/gifs/${n}${q(couch)}`);
    const react = (who, n, body, couch = A, season = sid) => as[who].call("POST", `/api/seasons/${season}/gifs/${n}${q(couch)}`, body);
    const names = (body) => (body.people ?? []).map((p) => p.name).sort().join();
    const stored = async (who, n, season = sid) => (await pool.query("SELECT gif FROM episode_gifs WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], season, n])).rows[0]?.gif ?? null;
    const episodes = async (who, couch = A) => (await as[who].call("GET", `/api/seasons/${sid}/episodes${q(couch)}`)).body;
    const ep = (body, n) => (body.episodes ?? []).find((x) => x.number === n);
    const share = (who, sharing) => as[who].call("PUT", "/api/me/profile", { sharing });
    const hub = async (who) => (await as[who].call("GET", `/api/couches/${A}/hub`)).body;
    const ratingOf = (h, who) => (h.rankings?.all?.find((r) => r.userId === U[who])?.byKind ?? []).find((k) => k.kind === "rating")?.points ?? 0;

    // The stand-in's GIFs, as /api/gifs hands them out.
    const found = async (word) => (await as.alex.call("GET", `/api/gifs?q=${encodeURIComponent(word)}`)).body.gifs?.[0];
    const G = {};
    for (const [key, word] of [["omg", "omg"], ["clap", "clap"], ["knew", "knew"], ["nope", "nope"], ["popcorn", "popcorn"], ["crying", "crying"]]) G[key] = await found(word);
    check(Object.values(G).every((g) => g && g.url.startsWith(gifs.url) && g.preview), "the stand-in's GIFs, through /api/gifs", JSON.stringify(G.omg));

    // ---------- yours, and the couch's ----------
    const rileyPoints0 = ratingOf(await hub("alex"), "riley");
    let r = await react("alex", 5, { gif: G.omg });
    check(r.status === 200 && r.body.mine?.id === G.omg.id && r.body.mine.url === G.omg.url && r.body.episode === 5 && r.body.seasonId === sid, "alex posts a GIF for Episode 5: it's his", JSON.stringify(r.body).slice(0, 300));
    check(r.body.people.length === 0 && r.body.of === 4 && r.body.search === true, "nobody else's yet; 4 on the couch share the show; GIFs are on", JSON.stringify({ people: r.body.people, of: r.body.of, search: r.body.search }));
    const kept = await stored("alex", 5);
    check(
      !!kept && Object.keys(kept).sort().join() === "h,id,title,url,w" && ["id", "url", "w", "h", "title"].every((k) => kept[k] === G.omg[k]),
      "kept as the chat keeps one (id, url, w, h, title; no preview)",
      JSON.stringify(kept)
    );
    r = await read("alex", 5);
    check(r.status === 200 && r.body.mine?.id === G.omg.id, "GET: his, as mine", JSON.stringify(r.body).slice(0, 200));
    check((await react("riley", 5, { gif: G.clap })).status === 200 && (await react("jordan", 5, { gif: G.knew })).status === 200, "riley and jordan post theirs");
    r = await read("alex", 5);
    check(names(r.body) === [u("jordan"), u("riley")].sort().join() && !r.body.people.some((p) => p.userId === U.alex) && r.body.of === 4, "alex's read: riley's and jordan's in people (never his own), of 4", JSON.stringify({ people: names(r.body), of: r.body.of }));
    check(r.body.people[0].name === u("jordan") && r.body.people.find((p) => p.name === u("riley")).gif.id === G.clap.id, "newest first, each with their GIF", JSON.stringify(r.body.people));
    r = await react("alex", 5, { gif: G.popcorn });
    check(r.body.mine?.id === G.popcorn.id && (await pool.query("SELECT count(*)::int AS n FROM episode_gifs WHERE user_id = $1 AND season_id = $2", [U.alex, sid])).rows[0].n === 1, "posting again changes his: still one", JSON.stringify(r.body.mine));
    await react("alex", 5, { gif: G.omg });

    // ---------- the guard ----------
    for (const n of [4, 5]) {
      r = await read("sam", n);
      check(r.status === 403 && !JSON.stringify(r.body).includes("zt"), `sam (on 3) reads Episode ${n}: 403, nothing about it`, `${r.status} ${JSON.stringify(r.body)}`);
      r = await react("sam", n, { gif: G.nope });
      check(r.status === 403 && !(await stored("sam", n)), `and can't post for it: 403, nothing kept`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    await react("riley", 3, { gif: G.crying });
    r = await react("sam", 3, { gif: G.nope });
    check(r.status === 200 && r.body.mine?.id === G.nope.id && names(r.body) === u("riley"), "sam posts for Episode 3: his, and riley's beside it", JSON.stringify(r.body).slice(0, 300));
    r = await react("alex", 6, { gif: G.omg });
    check(r.status === 403 && /haven't seen Episode 6/.test(r.body.error), "alex (on 5) can't post for Episode 6: 403", JSON.stringify(r.body));
    await pool.query(`INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = true`, [U.casey]);
    r = await react("casey", 6, { gif: G.omg }, X);
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "casey sees everything straight away: Episode 6 hasn't aired, 409", JSON.stringify(r.body));
    await pool.query(`UPDATE user_settings SET show_results_immediately = false WHERE user_id = $1`, [U.casey]);

    // ---------- the refusals ----------
    r = await react("alex", 5, {});
    check(r.status === 400 && /Which GIF/.test(r.body.error), "no gif key: 400 Which GIF?", JSON.stringify(r.body));
    r = await react("alex", 5, { gif: { ...G.omg, url: "https://example.com/x.gif" } });
    check(r.status === 400 && (await stored("alex", 5)).id === G.omg.id, "a GIF from anywhere but KLIPY: 400, his kept as it was", JSON.stringify(r.body));
    r = await react("alex", 5, { gif: { ...G.omg, w: "wide" } });
    check(r.status === 400, "a GIF that isn't one: 400", JSON.stringify(r.body));
    r = await alexOff.call("POST", `/api/seasons/${sid}/gifs/5${q(A)}`, { gif: G.omg });
    check(r.status === 400 && /GIFs aren't on here/.test(r.body.error), "GIFs off (x-gys-gifs: off): 400 GIFs aren't on here", JSON.stringify(r.body));
    r = await alexOff.call("GET", `/api/seasons/${sid}/gifs/5${q(A)}`);
    check(r.status === 200 && r.body.search === false && r.body.mine?.id === G.omg.id, "and its read: search false, his still there", JSON.stringify(r.body).slice(0, 200));
    r = await as.alex.call("POST", `/api/seasons/${sid}/gifs/zero${q(A)}`, { gif: G.omg });
    check(r.status === 400, "an episode that isn't one: 400");
    r = await as.alex.call("GET", `/api/seasons/not-a-season/gifs/5${q(A)}`);
    check(r.status === 404, "a season that isn't one: 404");
    r = await react("casey", 5, { gif: G.omg }, A);
    check(r.status === 404 && !(await stored("casey", 5)), "posting on a couch you're not on: 404", `${r.status} ${JSON.stringify(r.body)}`);
    check((await read("casey", 5, A)).status === 404, "and reading on it: 404");

    // ---------- taking it back ----------
    r = await react("sam", 3, { gif: null });
    check(r.status === 200 && r.body.mine === null && !(await stored("sam", 3)) && names(r.body) === u("riley"), "{ gif: null }: sam's taken back, riley's still there", JSON.stringify(r.body).slice(0, 200));

    // ---------- what's shared ----------
    r = await share("riley", { gifs: false });
    check(r.status === 200 && r.body.sharing?.on?.gifs === false, "riley turns My episode GIFs off", JSON.stringify(r.body.sharing));
    r = await read("alex", 5);
    check(names(r.body) === u("jordan") && r.body.of === 3, "hers leaves alex's read, and of is 3", JSON.stringify({ people: names(r.body), of: r.body.of }));
    check((await read("riley", 5)).body.mine?.id === G.clap.id, "she still sees her own");
    check(ep(await episodes("alex"), 5)?.gifs?.n === 2, "and Episodes counts 2", JSON.stringify(ep(await episodes("alex"), 5)?.gifs));
    await share("riley", { gifs: true });
    r = await read("alex", 5);
    check(names(r.body) === [u("jordan"), u("riley")].sort().join() && r.body.of === 4, "on again: back", JSON.stringify({ people: names(r.body), of: r.body.of }));
    // The Traitors: riley follows openly (through 2), jordan privately (through 4).
    r = await react("jordan", 2, { gif: G.knew }, A, tsid);
    check(r.status === 200 && r.body.mine?.id === G.knew.id, "jordan (watching the Traitors privately) posts for its Episode 2");
    r = await react("riley", 2, { gif: G.clap }, A, tsid);
    check(r.status === 200 && r.body.people.length === 0 && r.body.of === 1, "riley's read of it: jordan's reaches nobody; of 1 (her)", JSON.stringify({ people: r.body.people, of: r.body.of }));
    // Another couch: casey on ZT Extra, with alex.
    check((await react("casey", 5, { gif: G.nope }, X)).status === 200, "casey posts for Episode 5 on ZT Extra");
    r = await read("alex", 5, X);
    check(names(r.body) === u("casey") && r.body.of === 2, "alex's read on ZT Extra: casey's, of 2", JSON.stringify({ people: names(r.body), of: r.body.of }));
    check(!(await read("alex", 5)).body.people.some((p) => p.name === u("casey")), "and not on ZT Survivor 51");
    // No couch: only yours.
    r = await read("alex", 5, null);
    check(r.status === 200 && r.body.mine?.id === G.omg.id && r.body.people.length === 0 && r.body.of === 0, "no couch: only his, of 0", JSON.stringify(r.body).slice(0, 200));
    // Solo: zt_so_ people on no couch.
    const solo = {};
    for (const who of ["alex", "riley"]) solo[who] = await api({ user: soloFixture.username(who), pass: PASSWORD, headers: stand });
    await solo.riley.call("POST", `/api/seasons/${so.seasonId}/gifs/5`, { gif: G.clap });
    r = await solo.alex.call("POST", `/api/seasons/${so.seasonId}/gifs/5`, { gif: G.omg });
    check(r.status === 200 && r.body.mine?.id === G.omg.id && r.body.people.length === 0 && r.body.of === 0 && !/zt_so_riley/.test(JSON.stringify(r.body)), "solo: zt_so_alex's is his alone, a stranger's never sent, of 0", JSON.stringify(r.body).slice(0, 200));
    const soloEp = (await solo.alex.call("GET", `/api/seasons/${so.seasonId}/episodes`)).body.episodes?.find((x) => x.number === 5);
    check(soloEp?.gifs?.n === 1 && soloEp.gifs.mine === true, "and his Episodes counts only his", JSON.stringify(soloEp?.gifs));

    // ---------- the Episodes read ----------
    let e = await episodes("alex");
    const g5 = ep(e, 5)?.gifs;
    check(g5?.n === 3 && g5.mine === true && g5.urls.length === 3 && g5.urls[0] === G.omg.url, "Episodes: Episode 5's GIFs, 3, his among them, three pictures, his first", JSON.stringify(g5));
    check(JSON.stringify(ep(e, 4)?.gifs) === JSON.stringify({ n: 0, mine: false, urls: [] }) && ep(e, 3)?.gifs?.n === 1 && ep(e, 3).gifs.mine === false, "Episode 4 none; Episode 3 riley's", JSON.stringify([ep(e, 4)?.gifs, ep(e, 3)?.gifs]));
    check(e.episodes.every((x) => x.verdict === undefined), "no verdicts left on it");
    e = await episodes("sam");
    check([4, 5].every((n) => !ep(e, n) || ep(e, n).gifs === undefined) && ep(e, 3)?.gifs?.n === 1, "sam's: Episode 3's (riley's), nothing on 4 or 5", JSON.stringify(e.episodes.filter((x) => x.number >= 3).map((x) => [x.number, x.status, x.gifs])));

    // ---------- Couch points ----------
    const h = await hub("alex");
    const rileyPoints = ratingOf(h, "riley");
    // riley: Survivor's 5 and 3 (changing hers, off and on again, doesn't count twice), the Traitors' 2.
    check(rileyPoints - rileyPoints0 === 6, "Couch points: riley's GIFs count as the rating kind, 2 an episode (three episodes: 6)", `${rileyPoints0} → ${rileyPoints}`);
    check(ratingOf(h, "sam") === 0, "sam took his back: nothing counted", String(ratingOf(h, "sam")));

    if (!apiOnly) {
      const noBadge = () =>
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      let shots = 0;
      const browse = async (who) => {
        const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off", headers: stand });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        const pg = b.page;
        return {
          pg,
          shot: async (name) => {
            await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
            await pg.screenshot({ path: path.join(out, `${String(++shots).padStart(2, "0")}-${who}-${name}.png`) });
          },
          wide: async (what) => {
            const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            check(over <= 0, `${what}: nothing wider than the screen`, `${over}px over`);
          },
          errors: () => b.errors.filter((x) => !/favicon|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(x)),
          sheet: () => pg.locator("[role=dialog][data-open]"),
          closed: () => pg.locator("[role=dialog][data-open]").waitFor({ state: "detached", timeout: 10_000 }).catch(() => {}),
        };
      };
      const gifIn = async (loc) => (await loc.locator("img").first().getAttribute("src").catch(() => null)) || "";

      // ---------- alex: Tonight's row, the sheet, Pick another ----------
      const X1 = await browse("alex");
      const pg = X1.pg;
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const row = pg.locator('[data-gif-row="5"]');
      await row.waitFor({ timeout: 60_000 });
      await pg.locator('[data-gif-row="5"][data-reacted="yes"]').waitFor({ timeout: 20_000 }).catch(() => {});
      await pg.waitForTimeout(600);
      const rowText = (await row.innerText()).replace(/\s+/g, " ");
      check((await row.getAttribute("data-reacted")) === "yes" && /Your GIF for Episode 5/.test(rowText) && /2 on the couch too/.test(rowText) && (await gifIn(row)) === G.omg.url, "Tonight's Extras: Your GIF for Episode 5, his picture, 2 on the couch too", rowText);
      await row.scrollIntoViewIfNeeded();
      await X1.shot("tonight-row");
      await X1.wide("Tonight");
      await row.click();
      const posted = X1.sheet().locator('[data-gif-react="posted"]');
      await posted.waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(500);
      check(/Your GIF for Episode 5/i.test(await X1.sheet().innerText()) && (await gifIn(posted.locator('[data-gif-tile="you"]'))) === G.omg.url, "the sheet: Your GIF for Episode 5, his tile", await X1.sheet().innerText());
      const couch = posted.locator("[data-couch-gifs]");
      check(
        (await couch.locator(`[data-gif-tile="${u("riley")}"]`).count()) === 1 && (await couch.locator(`[data-gif-tile="${u("jordan")}"]`).count()) === 1 && /3 of 4/.test(await couch.innerText()),
        "the couch so far: riley's and jordan's tiles, 3 of 4",
        await couch.innerText()
      );
      await X1.shot("sheet-posted");
      await X1.wide("the GIF sheet");
      await posted.locator("[data-gif-again]").click();
      const pick = X1.sheet().locator('[data-gif-react="pick"]');
      await pick.locator("[data-gif-grid] [data-gif]").first().waitFor({ timeout: 15_000 });
      await pg.waitForTimeout(400);
      check(/How was Episode 5\?/i.test(await X1.sheet().innerText()) && (await pick.locator("[data-gif-search]").count()) === 1 && (await pick.locator("[data-gif]").count()) === fakeGifs.GIFS.length, "Pick another: How was Episode 5?, the search, what's featured", await X1.sheet().innerText());
      check((await pick.getByRole("button", { name: "Keep the one I had" }).count()) === 1, "and Keep the one I had");
      await X1.shot("picker");
      await X1.wide("the picker");
      await pick.locator("[data-gif-search]").fill("plot");
      await pg.waitForFunction(() => document.querySelectorAll('[role=dialog][data-open] [data-gif-react="pick"] [data-gif]').length === 1, null, { timeout: 10_000 }).catch(() => {});
      await pick.locator(`[data-gif="${fakeGifs.idOf("Plot twist")}"]`).click();
      await posted.waitFor({ timeout: 15_000 });
      await pg.waitForTimeout(400);
      check((await stored("alex", 5))?.id === fakeGifs.idOf("Plot twist") && (await gifIn(posted.locator('[data-gif-tile="you"]'))).includes(fakeGifs.idOf("Plot twist")), "a search and a tap: posted, the new one his", JSON.stringify(await stored("alex", 5)));
      await X1.shot("sheet-reposted");
      await X1.sheet().getByRole("button", { name: "Done" }).click();
      await X1.closed();
      await pg.waitForFunction((id) => (document.querySelector('[data-gif-row="5"] img')?.getAttribute("src") || "").includes(id), fakeGifs.idOf("Plot twist"), { timeout: 10_000 }).catch(() => {});
      check((await gifIn(row)).includes(fakeGifs.idOf("Plot twist")), "Done: the row has the new one", await gifIn(row));

      // Episodes, and the episode page.
      await pg.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
      const stack = pg.locator('[data-ep="5"] [data-gif-stack]');
      await stack.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(600);
      check((await stack.getAttribute("data-gif-stack")) === "3" && (await stack.locator("img").count()) === 3 && (await gifIn(stack)).includes(fakeGifs.idOf("Plot twist")), "Episodes: Episode 5's stack of 3, his first", await stack.innerText());
      check((await pg.locator('[data-ep="3"] [data-gif-stack="1"]').count()) === 1 && (await pg.locator('[data-ep="4"] [data-gif-stack]').count()) === 0, "Episode 3's one (riley's), none on 4");
      await X1.shot("episodes");
      await X1.wide("Episodes");
      await pg.locator('[data-ep="5"]').click();
      const epRow = pg.locator('[data-episode-gif] [data-gif-row="5"]');
      await epRow.waitFor({ timeout: 20_000 });
      await epRow.scrollIntoViewIfNeeded();
      await pg.waitForTimeout(400);
      check((await epRow.getAttribute("data-reacted")) === "yes" && /How was it\?/i.test(await pg.locator("[data-episode-gif]").innerText()), "the episode page: How was it?, his GIF's row", await pg.locator("[data-episode-gif]").innerText());
      await X1.shot("episode-page");
      check(X1.errors().length === 0, "no page errors (alex)", X1.errors().join(" | "));

      // ---------- sam, behind ----------
      const S = await browse("sam");
      await S.pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const srow = S.pg.locator('[data-gif-row="3"]');
      await srow.waitFor({ timeout: 30_000 });
      await S.pg.waitForTimeout(800);
      const srowText = (await srow.innerText()).replace(/\s+/g, " ");
      check((await srow.getAttribute("data-reacted")) === "no" && /React to Episode 3/.test(srowText) && /1 on the couch already did/.test(srowText), "sam's Tonight: React to Episode 3 (1 on the couch already did)", srowText);
      check((await S.pg.locator('[data-gif-row="4"], [data-gif-row="5"]').count()) === 0, "nothing for 4 or 5");
      await srow.scrollIntoViewIfNeeded();
      await S.shot("tonight-row");
      await S.wide("sam's Tonight");
      await srow.click();
      const spick = S.sheet().locator('[data-gif-react="pick"]');
      await spick.locator("[data-gif-grid] [data-gif]").first().waitFor({ timeout: 20_000 });
      await S.pg.waitForTimeout(400);
      check(/How was Episode 3\?/i.test(await S.sheet().innerText()) && /1 on the couch already did/.test(await spick.innerText()), "the picker: How was Episode 3?, 1 on the couch already did", await S.sheet().innerText());
      await S.shot("picker");
      await spick.locator(`[data-gif="${fakeGifs.idOf("Iconic")}"]`).click();
      const sposted = S.sheet().locator('[data-gif-react="posted"]');
      await sposted.waitFor({ timeout: 15_000 });
      await S.pg.waitForTimeout(500);
      check((await stored("sam", 3))?.id === fakeGifs.idOf("Iconic") && (await sposted.locator(`[data-gif-tile="${u("riley")}"]`).count()) === 1, "a tap posts it: his, and riley's beside it", JSON.stringify(await stored("sam", 3)));
      const sheetHtml = await S.sheet().innerHTML();
      check(![G.clap.id, G.knew.id, fakeGifs.idOf("Plot twist")].some((id) => sheetHtml.includes(id)), "nothing of Episode 5's GIFs in it");
      await S.shot("sheet-posted");
      await S.wide("sam's sheet");
      await S.sheet().getByRole("button", { name: "Done" }).click();
      await S.closed();
      check(S.errors().length === 0, "no page errors (sam)", S.errors().join(" | "));

      // ---------- the reveal: the couch's GIFs slide ----------
      // alex back on Episode 4 with no GIF for 5: Episode 5's results are his to reveal.
      await pool.query("DELETE FROM episode_gifs WHERE user_id = $1 AND season_id = $2 AND episode = 5", [U.alex, sid]);
      await pool.query("UPDATE league_memberships SET results_seen_through = 4 WHERE user_id = $1", [U.alex]);
      await pool.query("UPDATE show_follows SET seen_through = 4, early_seen = NULL WHERE user_id = $1 AND season_id = $2", [U.alex, sid]);
      const V = await browse("alex");
      const vp = V.pg;
      await vp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      // Up next's plate (docs/PLAN-up-next.md): I watched it, then Yes, show me.
      const revealBtn = vp.locator("[data-results-in='5'] [data-up-next-watched]");
      await revealBtn.waitFor({ timeout: 30_000 });
      await vp.waitForTimeout(600);
      await revealBtn.click();
      await vp.locator("[data-watched-yes]").click();
      await vp.waitForURL(/\?page=reveal/, { timeout: 15_000 });
      const reveal = vp.locator("[role=dialog][aria-label='The reveal']");
      await reveal.locator("[data-beat]").first().waitFor({ timeout: 30_000 });
      const beats = [];
      const beatNow = async () => reveal.locator("[data-beat]").getAttribute("data-beat").catch(() => null);
      const next = async () => {
        const was = await beatNow();
        await reveal.locator("[data-stage]").click();
        await vp.waitForFunction((w) => document.querySelector("[role=dialog][aria-label='The reveal'] [data-beat]")?.getAttribute("data-beat") !== w, was, { timeout: 5000 }).catch(() => {});
        await vp.waitForTimeout(300);
      };
      for (let k = 0; k < 10; k++) {
        await vp.waitForTimeout(500);
        const b = await beatNow();
        if (beats.at(-1) !== b) beats.push(b);
        if (b === "gifs") break;
        await next();
      }
      check(beats.at(-1) === "gifs" && beats.at(-2) === "out", "the reveal: the couch's GIFs come right after who went home", beats.join(" > "));
      const slide = reveal.locator("[data-gifs-beat]");
      await vp.waitForFunction(() => (document.querySelector("[data-gifs-beat]")?.getAttribute("data-gifs-beat") ?? "loading") !== "loading", null, { timeout: 15_000 }).catch(() => {});
      await vp.waitForTimeout(400);
      const slideText = (await slide.innerText().catch(() => "")).replace(/\s+/g, " ");
      check(
        (await slide.getAttribute("data-gifs-beat")) === "2" && (await slide.locator(`[data-gif-tile="${u("riley")}"]`).count()) === 1 && (await slide.locator(`[data-gif-tile="${u("jordan")}"]`).count()) === 1,
        "The couch reacts: riley's and jordan's tiles",
        slideText
      );
      check((await slide.locator("[data-gif-yours-empty]").count()) === 1 && /Yours goes here/.test(slideText) && /2 of 4 on the couch/.test(slideText), "Yours goes here; 2 of 4 on the couch", slideText);
      const add = reveal.locator("[data-gifs-add]");
      check((await add.count()) === 1 && (await add.isVisible()) && /Add your GIF/.test(await add.innerText()), "Add your GIF under the stage");
      await V.shot("reveal-gifs");
      await V.wide("the reveal's GIF slide");
      await add.click();
      const vpick = V.sheet().locator('[data-gif-react="pick"]');
      await vpick.locator("[data-gif-grid] [data-gif]").first().waitFor({ timeout: 20_000 });
      await vp.waitForTimeout(500);
      // Over the reveal: what's at the picker's middle is the sheet's, not the reveal's.
      const onTop = await vp.evaluate(() => {
        const g = document.querySelector('[role=dialog][data-open] [data-gif-react="pick"] [data-gif]');
        if (!g) return "no picker";
        const r = g.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit && g.contains(hit) ? "sheet" : hit?.closest("[aria-label='The reveal']") ? "reveal" : String(hit?.tagName);
      });
      check(onTop === "sheet" && /How was Episode 5\?/i.test(await V.sheet().innerText()), "Add your GIF opens the sheet over the reveal", onTop);
      await V.shot("reveal-sheet");
      await vpick.locator(`[data-gif="${fakeGifs.idOf("Screaming")}"]`).click();
      await V.sheet().locator('[data-gif-react="posted"]').waitFor({ timeout: 15_000 });
      check((await stored("alex", 5))?.id === fakeGifs.idOf("Screaming"), "a tap posts his", JSON.stringify(await stored("alex", 5)));
      await V.sheet().getByRole("button", { name: "Done" }).click();
      await V.closed();
      await slide.locator('[data-gif-tile="you"]').waitFor({ timeout: 10_000 }).catch(() => {});
      await vp.waitForTimeout(400);
      check(
        (await slide.locator('[data-gif-tile="you"]').count()) === 1 && (await slide.locator("[data-gif-yours-empty]").count()) === 0 && (await reveal.locator("[data-gifs-add]").count()) === 0 && (await beatNow()) === "gifs",
        "back on the slide: his tile in place of Yours goes here, no Add your GIF, still the GIF slide"
      );
      await V.shot("reveal-gifs-yours");
      for (let k = 0; k < 10; k++) {
        if ((await reveal.getByRole("button", { name: /^Back to / }).count()) && (await reveal.getByRole("button", { name: /^Back to / }).first().isVisible())) break;
        await next();
        const b = await beatNow();
        if (beats.at(-1) !== b) beats.push(b);
      }
      const after = beats.slice(beats.indexOf("gifs") + 1);
      check(after[0] === "lineup" && after.includes("games") && after.at(-1) === "table" && !after.includes("gifs"), "then the lineup, the games and the table", beats.join(" > "));
      check(V.errors().length === 0, "no page errors (the reveal)", V.errors().join(" | "));
    }
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    for (const close of closers.reverse()) await close().catch(() => {});
    if (!keep) {
      await soloFixture.down(pool).catch((e) => console.log("FAIL  solo-fixture down: " + e.message));
      await fixture.down(pool);
    }
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
