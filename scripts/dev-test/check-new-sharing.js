// Dev-only check for What your couch sees (docs/PLAN-new-design.md step 15 part 3), against the dev server, on new-fixture.js's
// couch ("ZT Survivor 51": alex owns it, riley, jordan and sam on it; casey with alex on "ZT Extra"), streaming-fixture.js's
// seasons (ZT Severed: alex on 3, riley 6, jordan 9) and hub-fixture.js's finished ZT Survivor 49 and 50.
//   API:
//   - migration 0137's four switches; the profile's sharing (Everything by default) and its lines ("zt_nd_alex is on Episode 5
//     of ..."), refusals, a level, one switch over a level;
//   - Where I am: what someone watches and how far they are on everyone's home read (members' `at`) and the space's people
//     (`seen`), the couch's shows, the feed's "started watching", reveal lines (read, and none written while it's off), First to
//     finish and the chat's fold by progress (and its push's words, through fake-push.js) all answer to it; a show watched
//     privately never shows;
//   - When I'm watching: who's on now (the hub's On now and the Watch along card);
//   - My episode ratings: the couch verdict; My watch along reactions: the watch along's stream and its count;
//   - trivia's Seen it all: an earlier season of the show, over, marked seen to the end without following it (casey), so the
//     round asks about it; refused on a season not over, another show's, one you play.
//   In a real browser at --width (390 by default): as alex, Settings' What your couch sees (the three levels, what riley sees
//   about you, Just my games with Hidden lines, Customize's switches making your own mix, Undo, Everything again); Severed's
//   Who's watching ("Ep 6 of 10", "3 ahead", progress bars); the hub's rail ("· Ep") and The couch is watching (riley · Ep 2 on
//   the Traitors); as casey, trivia's Seen an earlier season? (Seen it all, Yes, all 13). Nothing wider than the screen; no page
//   errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-sharing.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings the fixtures up and takes them down (--keep leaves them); touches zt rows only; never sends a
// real push (every subscription is fake-push.js's); refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const streamingFixture = require("./streaming-fixture");
const hubFixture = require("./hub-fixture");
const fakePush = require("./fake-push");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-sharing runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-sharing.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const push = await fakePush.start();
  closers.push(push.down);
  try {
    const fx = await fixture.up(pool);
    const st = await streamingFixture.up(pool, fx);
    const hub = await hubFixture.up(pool, fx);
    const S = st.seasons;
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    const U = fx.users;
    const C = fx.couchId;
    const q = `?couch=${C}`;
    const u = fixture.username;
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) {
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [U[who]]);
    }
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    // alex's phone is the stand-in's (nothing reaches a real push service), and he hears every chat message.
    const sub = push.subscription("alex");
    await pool.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, 'zt sharing check')", [U.alex, sub.endpoint, sub.p256dh, sub.auth]);
    await pool.query("INSERT INTO notification_prefs (user_id, chat) VALUES ($1, 'all') ON CONFLICT (user_id) DO UPDATE SET chat = 'all'", [U.alex]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: u(who), pass: PASSWORD });
    const profile = async (who) => (await as[who].call("GET", "/api/me/profile")).body;
    const share = (who, sharing) => as[who].call("PUT", "/api/me/profile", { sharing });
    const home = async (who) => (await as[who].call("GET", "/api/me/home")).body;
    const memberOf = (h, who, couch = C) => h.couches.find((c) => c.id === couch)?.members.find((m) => m.userId === U[who]);
    const space = async (who, season) => (await as[who].call("GET", `/api/seasons/${season}/space${q}`)).body;
    const personOf = (sp, who) => sp.people.find((p) => p.userId === U[who]);
    const hubOf = async (who) => (await as[who].call("GET", `/api/couches/${C}/hub`)).body;
    const chatOf = async (who, season) => (await as[who].call("GET", `/api/seasons/${season}/chat${q}`)).body;

    // ---------- migration 0137 and the profile ----------
    const cols = (await pool.query("SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name LIKE 'share_%' ORDER BY column_name")).rows;
    check(
      cols.map((c) => c.column_name).join() === "share_now,share_ratings,share_reactions,share_where" && cols.every((c) => c.column_default === "true" && c.is_nullable === "NO"),
      "migration 0137: user_settings.share_where, share_now, share_ratings, share_reactions, on by default",
      JSON.stringify(cols)
    );
    let p = await profile("alex");
    check(JSON.stringify(p.sharing?.on) === JSON.stringify({ where: true, now: true, ratings: true, reactions: true }), "alex shares everything by default (the recommended level)", JSON.stringify(p.sharing));
    check(
      /^zt_nd_alex (is on Episode \d+ of|finished) ZT /.test(p.sharing.lines.where) && /^zt_nd_alex is watching ZT .+ now$/.test(p.sharing.lines.now),
      "what riley sees about him, from his own shows: where he is, that he's watching",
      JSON.stringify(p.sharing.lines)
    );
    check(p.sharing.lines.ratings === "zt_nd_alex's episode ratings" && p.sharing.lines.reactions === "zt_nd_alex's watch along reactions", "no ratings or reactions of his yet: what each would share", JSON.stringify(p.sharing.lines));
    for (const [bad, what] of [[{ preset: "some" }, "a level we don't have"], [{ now: "no" }, "a switch that isn't true or false"], [{}, "nothing"], [{ where: true, colour: 1 }, "something else"]]) {
      check((await share("alex", bad)).status === 400, `sharing refused: ${what}`);
    }
    let r = await share("alex", { preset: "games" });
    const row = async (who) => (await pool.query("SELECT share_where, share_now, share_ratings, share_reactions FROM user_settings WHERE user_id = $1", [U[who]])).rows[0];
    check(r.status === 200 && JSON.stringify(r.body.sharing.on) === JSON.stringify({ where: false, now: false, ratings: true, reactions: true }), "Just my games: where and now off", JSON.stringify(r.body.sharing));
    check(JSON.stringify(await row("alex")) === JSON.stringify({ share_where: false, share_now: false, share_ratings: true, share_reactions: true }), "kept in user_settings");
    r = await share("alex", { now: true });
    check(r.body.sharing.on.now === true && r.body.sharing.on.where === false && r.body.sharing.on.ratings === true, "one switch over the level: When I'm watching back on, the rest as they were");
    r = await share("alex", { preset: "all" });
    check(Object.values(r.body.sharing.on).every(Boolean), "Everything again");

    // ---------- Where I am ----------
    let h = await home("alex");
    check(memberOf(h, "riley").watching.includes(tid) && memberOf(h, "riley").at[tid] === 2, "alex's home: riley watches the Traitors, on Episode 2", JSON.stringify(memberOf(h, "riley").at));
    check(memberOf(h, "riley").at[S.severed] === 6 && memberOf(h, "jordan").at[S.severed] === 9 && memberOf(h, "sam").at[sid] === 3, "and how far each is elsewhere: riley 6 and jordan 9 on Severed, sam 3 on Survivor");
    check(!memberOf(h, "jordan").watching.includes(tid) && !(tid in memberOf(h, "jordan").at), "jordan's private Traitors: not there, nor how far she is");
    check(h.couchShows.some((s) => s.seasonId === tid), "the Traitors is a couch show alex doesn't follow");
    let sp = await space("alex", tid);
    check(personOf(sp, "riley").watching === true && personOf(sp, "riley").seen === 2 && personOf(sp, "jordan").watching === false && personOf(sp, "jordan").seen === null, "the Traitors' space: riley watching on 2, jordan nothing", JSON.stringify(sp.people));
    sp = await space("sam", sid);
    check(personOf(sp, "alex").seen === 5 && personOf(sp, "riley").seen === 5 && personOf(sp, "sam").seen === null, "Survivor's space for sam: alex and riley on 5; his own isn't in people (it's `you`)", JSON.stringify(sp.people.map((x) => x.seen)));
    let feed = (await hubOf("alex")).feed ?? [];
    check(feed.some((i) => i.kind === "watching" && i.userId === U.riley), "the hub's feed: riley started watching the Traitors");
    let chat = await chatOf("alex", sid);
    const rileyReveals = (c) => c.messages.filter((m) => m.type === "reveal" && m.userId === U.riley).length;
    check(rileyReveals(chat) > 0, "Survivor's chat: riley's reveal lines", String(rileyReveals(chat)));

    await share("riley", { preset: "games" });
    h = await home("alex");
    check(!memberOf(h, "riley").watching.length && !Object.keys(memberOf(h, "riley").at).length, "riley on Just my games: nothing she watches, nor how far, on alex's home", JSON.stringify(memberOf(h, "riley")));
    check(!h.couchShows.some((s) => s.seasonId === tid), "so the Traitors isn't a couch show any more (jordan's is private)");
    sp = await space("alex", tid);
    check(personOf(sp, "riley").watching === false && personOf(sp, "riley").seen === null, "the Traitors' space: riley not watching, as far as alex can tell");
    sp = await space("alex", sid);
    check(personOf(sp, "riley").playing.length === 3 && personOf(sp, "riley").seen === null, "Survivor's: her games still show (the games need them), not how far she is", JSON.stringify(personOf(sp, "riley")));
    check((await home("riley")).shows.some((s) => s.seasonId === tid && s.following), "her own home still has the Traitors");
    feed = (await hubOf("alex")).feed ?? [];
    check(!feed.some((i) => (i.kind === "watching" || i.kind === "revealed") && i.userId === U.riley), "the feed: neither what she started watching nor what she revealed");
    chat = await chatOf("alex", sid);
    check(rileyReveals(chat) === 0 && rileyReveals(await chatOf("riley", sid)) > 0, "Survivor's chat: none of her reveal lines for alex; she still sees her own");
    // A reveal while Where I am is off says nothing in chat.
    const samReveals = async () => (await pool.query("SELECT count(*)::int AS n FROM chat_messages WHERE user_id = $1 AND type = 'reveal'", [U.sam])).rows[0].n;
    const before = await samReveals();
    await share("sam", { where: false });
    r = await as.sam.call("POST", `/api/seasons/${sid}/reveal`, { episode: 4, couch: C });
    check(r.status === 200 && (await samReveals()) === before, "sam (Where I am off) reveals Episode 4: no reveal line", JSON.stringify(r.body).slice(0, 200));
    await share("sam", { where: true });
    r = await as.sam.call("POST", `/api/seasons/${sid}/reveal`, { episode: 5, couch: C });
    check(r.status === 200 && (await samReveals()) === before + 1, "on again, Episode 5: one line, as ever");
    await share("riley", { preset: "all" });
    check(memberOf(await home("alex"), "riley").at[tid] === 2, "riley back on Everything: there again");

    // First to finish answers to Where I am.
    const firstFinish = async (who) => ((await hubOf(who)).accolades ?? []).find((a) => a.key === "first-finish") ?? null;
    await as.jordan.call("PUT", `/api/me/follows/${S.severed}`, { seenThrough: 10 });
    await wait(50);
    await as.alex.call("PUT", `/api/me/follows/${S.severed}`, { seenThrough: 10 });
    let ff = await firstFinish("alex");
    check(ff?.who === u("jordan") && /ZT Severed/.test(ff.line), "Severed: jordan got to the end first, alex after (alex's By the numbers)", JSON.stringify(ff));
    await share("jordan", { where: false });
    ff = await firstFinish("alex");
    check(ff?.who === u("alex") && ff.line === "ZT Severed, in 20 days", "jordan stops sharing Where I am: she isn't counted, so it's alex", JSON.stringify(ff));
    await share("jordan", { where: true });
    await as.jordan.call("PUT", `/api/me/follows/${S.severed}`, { seenThrough: 9 });
    await as.alex.call("PUT", `/api/me/follows/${S.severed}`, { seenThrough: 3 });

    // The fold by progress answers to it too, and so do the chat push's words.
    const say = async (who, season, text) => (await as[who].call("POST", `/api/seasons/${season}/chat${q}`, { text })).body.message;
    const m1 = await say("riley", S.severed, "SH-RILEY six");
    chat = await chatOf("alex", S.severed);
    check(chat.fold?.byMark === true && chat.messages.find((m) => m.id === m1.id)?.folded === true, "Severed: riley's message folded for alex by her mark (she was further along)", JSON.stringify(chat.fold));
    check(await push.until(() => push.of("alex").some((x) => /SH-RILEY|further along/.test(x.body)), 15000), "and his push says so", JSON.stringify(push.of("alex").map((x) => x.body)));
    check(push.of("alex").some((x) => x.body === `${u("riley")} sent a message from further along. Catch up to read it.`), "'riley sent a message from further along'");
    await share("riley", { where: false });
    chat = await chatOf("alex", S.severed);
    check(chat.messages.find((m) => m.id === m1.id)?.folded === true && chat.fold?.byMark === false, "riley stops sharing Where I am: still folded, by airtime now (nothing says she was ahead)", JSON.stringify(chat.fold));
    check(!/author_?seen/i.test(JSON.stringify(chat)), "the mark itself is never sent");
    const pushed = push.of("alex").length;
    await say("riley", S.severed, "SH-RILEY again");
    check(await push.until(() => push.of("alex").length > pushed, 15000), "her next message reaches alex's phone");
    const last = push.of("alex").at(-1);
    check(/^zt_nd_riley sent a message\. It may be about Episode 4: catch up when you reveal\.$/.test(last?.body ?? "") && !/further along/.test(last?.body ?? ""), "worded by airtime: 'It may be about Episode 4', never 'from further along'", last?.body);
    await share("riley", { preset: "all" });

    // ---------- When I'm watching ----------
    const ws = (
      await pool.query("INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, mode, clock_ms, running_since) VALUES ($1, 6, $2, $3, 'stream', 60000, now()) RETURNING id", [S.severed, C, U.riley])
    ).rows[0].id;
    await pool.query("INSERT INTO watch_session_people (session_id, user_id) VALUES ($1, $2)", [ws, U.riley]);
    const onNow = async () => (await as.alex.call("GET", `/api/couches/${C}/now`)).body.now.map((w) => w.userId);
    const cardNow = async () => ((await as.alex.call("GET", `/api/seasons/${S.severed}/watch${q}`)).body.now ?? []).map((w) => w.userId);
    check((await onNow()).includes(U.riley) && (await cardNow()).includes(U.riley), "riley watching Severed along: on alex's On now and the Watch along card");
    await share("riley", { now: false });
    check(!(await onNow()).includes(U.riley) && !(await cardNow()).includes(U.riley), "When I'm watching off: on neither");
    check(memberOf(await home("alex"), "riley").at[S.severed] === 6, "where she is still shows (that's Where I am's)");
    await share("riley", { now: true });
    await pool.query("DELETE FROM watch_sessions WHERE id = $1", [ws]);

    // ---------- My episode ratings ----------
    r = await as.riley.call("POST", `/api/seasons/${sid}/ratings/4${q}`, { stars: 4 });
    check(r.status === 200, "riley rates Survivor's Episode 4", JSON.stringify(r.body).slice(0, 200));
    await as.alex.call("POST", `/api/seasons/${sid}/ratings/4${q}`, { stars: 5 });
    const verdict = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/ratings/4${q}`)).body;
    let v = await verdict("alex");
    check(v.people.some((x) => x.userId === U.riley && x.stars === 4) && v.n === 2 && v.avg === 4.5, "alex's verdict: riley's 4 beside his 5", JSON.stringify(v));
    await share("riley", { ratings: false });
    v = await verdict("alex");
    check(!v.people.some((x) => x.userId === U.riley) && v.n === 1 && v.avg === 5, "My episode ratings off: hers isn't in it, nor in the average", JSON.stringify(v));
    check((await verdict("riley")).mine?.stars === 4, "she still sees her own");
    p = await profile("alex");
    check(p.sharing.lines.ratings === "zt_nd_alex rated ZT Survivor 51 Episode 4 ★5", "alex's line for ratings: his latest", p.sharing.lines.ratings);
    await share("riley", { ratings: true });

    // ---------- My watch along reactions ----------
    r = await as.riley.call("POST", `/api/seasons/${sid}/watch/4${q}`, { at: 60000, kind: "text", text: "SH riley at a minute" });
    check(r.status === 200, "riley says something a minute into Episode 4", JSON.stringify(r.body).slice(0, 200));
    const stream = async () => (await as.alex.call("GET", `/api/seasons/${sid}/watch/4${q}&at=600000&since=-1&open=1`)).body;
    let w = await stream();
    check(w.reactions.some((x) => x.text === "SH riley at a minute") && w.count === 1 && w.people.some((x) => x.userId === U.riley), "alex's watch along of Episode 4: riley's reaction, counted", JSON.stringify({ count: w.count, people: w.people }));
    await share("riley", { reactions: false });
    w = await stream();
    check(!w.reactions.some((x) => x.text === "SH riley at a minute") && w.count === 0 && !w.people.length, "My watch along reactions off: not in his stream, nor its count", JSON.stringify({ count: w.count }));
    check((await profile("riley")).sharing.lines.reactions === "zt_nd_riley left 1 reaction on ZT Survivor 51", "riley's own line for reactions");
    await share("riley", { reactions: true });

    // ---------- trivia: Seen it all ----------
    // Survivor 50's accepted results (51's, as far as they go), so a round can ask about it for someone who didn't play it.
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) SELECT $1, name, tribe_name, photo_url, sort_order FROM season_cast WHERE season_id = $2`, [hub.seasons.s50, sid]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
       SELECT $1, episode_number, kind, castaway_name, method, event_type, 'accepted', true, now() FROM season_decisions WHERE season_id = $2 AND status = 'accepted'`,
      [hub.seasons.s50, sid]
    );
    await pool.query("UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1", [hub.seasons.s50]);
    const X = fx.extraCouchId;
    const trivia = async (who, couch) => (await as[who].call("GET", `/api/seasons/${sid}/trivia?couch=${couch}`)).body;
    let tv = await trivia("casey", X);
    check(tv.title === "ZT Survivor 51 trivia" && tv.past.map((x) => x.label).join() === "ZT Survivor 50" && tv.past[0].episodes === 13, "casey's round: Survivor 51 so far; Seen it all offers Survivor 50 (over, with results; 49 has none here)", JSON.stringify(tv.past));
    check(!(await trivia("alex", C)).past.length, "alex plays both: nothing to offer (his games' reveals move those)");
    const seenAll = (who, couch, seen) => as[who].call("POST", `/api/seasons/${sid}/trivia?couch=${couch}`, { seen });
    check((await seenAll("casey", X, sid)).status === 409, "Survivor 51 isn't over: 409");
    check((await seenAll("casey", X, tid)).status === 400, "another show's season: 400");
    check((await seenAll("alex", C, hub.seasons.s50)).status === 409, "alex plays Survivor 50: 409");
    r = await seenAll("casey", X, hub.seasons.s50);
    check(r.status === 200 && r.body.title === "ZT Survivor 50 trivia" && r.body.questions.length >= 1 && !r.body.past.length, "casey: Survivor 50 seen to the end, so this week's round is about it", JSON.stringify({ title: r.body.title, n: r.body.questions?.length, past: r.body.past }));
    const cf = (await pool.query("SELECT following, seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [U.casey, hub.seasons.s50])).rows[0];
    check(cf?.following === false && cf.seen_through === 13, "marked through 13, not followed", JSON.stringify(cf));
    check(!(await home("casey")).shows.some((s) => s.seasonId === hub.seasons.s50), "so it isn't on casey's shows");
    // Back as it was, for the browser to do it again.
    await pool.query("DELETE FROM show_follows WHERE user_id = $1 AND season_id = $2", [U.casey, hub.seasons.s50]);

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
        const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        const pg = b.page;
        const shot = async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.waitForTimeout(250);
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`) });
        };
        const wide = async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          check(over <= 1, `${who}: ${what} fits ${width}px`, `${over}px over`);
        };
        const toasted = async (re) => {
          try {
            await pg.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
            return true;
          } catch {
            return false;
          }
        };
        // The refusals the check asks for are 409s the browser logs; nothing else may be.
        const errors = () => b.errors.filter((e) => !/Failed to load resource.*favicon|responded with a status of 409/.test(e));
        return { b, pg, shot, wide, toasted, errors };
      };

      // ---------- alex: What your couch sees ----------
      const a = await browse("alex");
      const { pg } = a;
      await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
      const sec = pg.locator("[data-settings-sharing]");
      await sec.waitFor({ timeout: 30000 });
      await pg.waitForFunction(() => /ZT /.test(document.querySelector("[data-sees=where]")?.textContent || ""), null, { timeout: 15000 });
      await pg.waitForTimeout(800);
      check((await pg.locator("[data-preview]").evaluateAll((els) => els.map((e) => e.getAttribute("data-preview")))).join() === "settings.appearance", "Settings: only Appearance is still Preview (part 4's)");
      const choices = await sec.locator("[data-choice]").allInnerTexts();
      check(
        choices.length === 3 && /^Everything\s*Recommended/i.test(choices[0]) && /^Just my games/.test(choices[1]) && /^Only what games need/.test(choices[2]),
        "three levels: Everything (Recommended), Just my games, Only what games need",
        choices.join(" | ")
      );
      check((await sec.getAttribute("data-level")) === "all" && (await sec.locator('[data-choice="share-all"]').getAttribute("aria-checked")) === "true", "Everything is his");
      const seesHead = await sec.locator("[data-sharing-preview] > span").first().innerText();
      check(/^What zt_nd_\w+ sees about you$/i.test(seesHead), "What riley sees about you (someone on his couch)", seesHead);
      const lines = async () => sec.locator("[data-sees]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-sees")}:${e.getAttribute("data-shown")}:${e.lastElementChild.textContent.trim()}`));
      let ls = await lines();
      check(ls.length === 4 && ls.every((x) => x.includes(":yes:")) && /^where:yes:zt_nd_alex (is on Episode|finished)/.test(ls[0]), "four lines, each what it lets out", ls.join(" | "));
      await sec.scrollIntoViewIfNeeded();
      await a.wide("What your couch sees");
      await a.shot("sharing-everything");
      await sec.locator('[data-choice="share-games"]').click();
      check(await a.toasted(/Saved · your couch sees this from now on/), "Just my games: saved, said so");
      await pg.waitForFunction(() => document.querySelector("[data-settings-sharing]")?.getAttribute("data-level") === "games", null, { timeout: 10000 });
      ls = await lines();
      check(ls[0] === "where:no:Hidden" && ls[1] === "now:no:Hidden" && ls[2].startsWith("ratings:yes:") && ls[3].startsWith("reactions:yes:"), "where and when he's watching: Hidden; ratings and reactions still shared", ls.join(" | "));
      check(JSON.stringify(await row("alex")) === JSON.stringify({ share_where: false, share_now: false, share_ratings: true, share_reactions: true }), "saved on the server");
      const custom = sec.locator("[data-sharing-custom]");
      check(/Using the choice above/.test(await custom.locator("summary").innerText()), "Customize: using the choice above");
      await custom.locator("summary").click();
      await sec.locator('[data-setting="share-now"]').waitFor({ state: "visible" });
      await sec.locator('[data-setting="share-now"]').click();
      check(await a.toasted(/When I'm watching: shared/), "When I'm watching: shared, with its toast");
      await pg.waitForFunction(() => document.querySelector("[data-settings-sharing]")?.getAttribute("data-level") === "custom", null, { timeout: 10000 });
      check(/Your own mix/.test(await custom.locator("summary").innerText()) && (await sec.locator("[data-choice][aria-checked=true]").count()) === 0, "your own mix: none of the three is his");
      await custom.scrollIntoViewIfNeeded();
      await a.shot("sharing-custom");
      await pg.locator("[role=status]").getByRole("button", { name: /Undo/ }).click();
      await pg.waitForFunction(() => document.querySelector("[data-settings-sharing]")?.getAttribute("data-level") === "games", null, { timeout: 10000 });
      check((await row("alex")).share_now === false, "Undo: Just my games again");
      await sec.locator('[data-choice="share-all"]').click();
      await pg.waitForFunction(() => document.querySelector("[data-settings-sharing]")?.getAttribute("data-level") === "all", null, { timeout: 10000 });
      check(Object.values(await row("alex")).every(Boolean), "Everything again");

      // Severed's Who's watching: how far each is, and how far ahead of him.
      await pg.goto(`${BASE}/show/${S.severed}`, { waitUntil: "load" });
      const whos = pg.locator("[data-whos-watching]");
      await whos.waitFor({ timeout: 30000 });
      await pg.waitForTimeout(800);
      const whereOf = async (who) => pg.locator(`[data-watcher="${u(who)}"] [data-watcher-where]`).getAttribute("data-watcher-where");
      const aheadOf = async (who) => pg.locator(`[data-watcher="${u(who)}"] [data-ahead]`).getAttribute("data-ahead").catch(() => null);
      check((await whereOf("riley")) === "Ep 6 of 10" && (await whereOf("jordan")) === "Ep 9 of 10" && (await whereOf("alex")) === "Ep 3 of 10", "Severed: riley Ep 6 of 10, jordan Ep 9 of 10, him Ep 3 of 10");
      check((await aheadOf("riley")) === "3" && (await aheadOf("jordan")) === "6", "riley 3 ahead, jordan 6 ahead");
      await whos.scrollIntoViewIfNeeded();
      await a.wide("Who's watching");
      await a.shot("whos-watching");

      // The hub: the rail and The couch is watching.
      await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const chip = pg.locator(`[data-rail-chip="${S.severed}"] [data-rail-who]`);
      await chip.waitFor({ timeout: 30000 });
      await pg.waitForTimeout(800);
      const chipText = (await chip.textContent()).trim();
      check(/^zt_nd_(riley|jordan) Ep (6|9) · \+1$/.test(chipText), "the rail's Severed: the first of them and how far, '· +1'", chipText);
      await pg.locator("[data-rail-chip]").first().scrollIntoViewIfNeeded();
      await a.shot("rail");
      const watched = pg.locator('[data-watched="ZT Traitors 5"]');
      await watched.waitFor({ timeout: 15000 });
      // The face's initial is in the row too; the words are what follow it.
      const rileyLine = (await watched.locator(`[data-watched-who="${u("riley")}"]`).innerText()).trim();
      check(rileyLine.endsWith(`${u("riley")} · Ep 2`), "The couch is watching: the Traitors, riley · Ep 2", rileyLine);
      await watched.scrollIntoViewIfNeeded();
      await a.wide("the hub");
      await a.shot("couch-watching");
      check(a.errors().length === 0, "alex: no page errors", a.errors().join(" | "));

      // ---------- casey: trivia's Seen it all ----------
      const c = await browse("casey");
      await c.pg.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const trow = c.pg.locator("[data-this-week] [data-trivia-row]");
      await trow.waitFor({ timeout: 30000 });
      await c.pg.waitForTimeout(800);
      await trow.click();
      const tsheet = c.pg.locator("[role=dialog][data-open]");
      await tsheet.locator("[data-trivia-q]").waitFor({ timeout: 15000 });
      for (let i = 0; i < 3; i++) {
        if (!(await tsheet.locator("[data-trivia-q]").count())) break;
        await tsheet.locator("[data-trivia-option]").first().click();
        await c.pg.waitForTimeout(1400);
      }
      const pastRow = tsheet.locator('[data-trivia-past-season="ZT Survivor 50"]');
      await pastRow.waitFor({ timeout: 15000 });
      check(/Seen an earlier season\?/.test(await tsheet.locator("[data-trivia-past]").innerText()), "after his round: Seen an earlier season? with ZT Survivor 50", await tsheet.locator("[data-trivia-past]").innerText());
      await pastRow.scrollIntoViewIfNeeded();
      await c.shot("trivia-past");
      await pastRow.locator("[data-seen-all]").click();
      check((await pastRow.locator("[data-seen-all]").innerText()).trim() === "Yes, all 13", "the first tap asks once more: Yes, all 13");
      await pastRow.locator("[data-seen-all]").click();
      check(await c.toasted(/ZT Survivor 50: seen to the end/), "the second marks it, and says so");
      await tsheet.locator("[data-trivia-past]").waitFor({ state: "detached", timeout: 10000 });
      check((await pool.query("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [U.casey, hub.seasons.s50])).rows[0]?.seen_through === 13, "kept: Survivor 50 through 13");
      // The round it deals is Survivor 50's; this week's first play still counts, so it opens on his score, with Play again.
      await c.pg.waitForFunction(() => /ZT Survivor 50 trivia/i.test(document.querySelector("[role=dialog][data-open] h2")?.textContent || ""), null, { timeout: 10000 });
      check((await tsheet.locator("[data-trivia-done]").count()) === 1 && (await tsheet.locator("[data-trivia-q]").count()) === 0, "the sheet starts the new round fresh: his score this week, and Play again", await tsheet.innerText());
      await c.wide("trivia");
      await c.shot("trivia-marked");
      check(c.errors().length === 0, "casey: no page errors", c.errors().join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) {
      await hubFixture.down(pool).catch(() => {});
      await streamingFixture.down(pool).catch(() => {});
      await fixture.down(pool);
    }
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
