// Dev-only check for notifications by moment (docs/PLAN-new-design.md step 15 part 2), against the dev server, on new-fixture.js
// (the "ZT Survivor 51" couch: alex runs its three linked games, riley, jordan and sam play; casey is on "ZT Extra" with alex). No
// real push leaves the machine: every push goes to fake-push.js, a loopback stand-in push service whose subscriptions the check
// writes for the fixture's people (and, in the browser, the one "Turn on" makes), which decrypts each and keeps what it said.
// riley is on classic, everyone else on the new design; jordan's phone is in Los Angeles, riley's in London, sam's says nothing.
//   API:
//   - your moments (a moment is its classic types; classic's Account settings agrees and doesn't list the new design's own),
//     Couch chat's three choices, a show's own switches, your time zone kept from the home read and classic's /api/me;
//   - the couch chat in both designs: each reader's words as the chat would show them (folded: who, never what; Quiet on episode
//     nights: nothing; Never: nothing), classic's link for riley and the new design's for the rest, a show the couch only watches
//     reaching who follows it on the new design, a show's chat switched off;
//   - waivers: a run's push opens the Waivers page; Tonight's "Waivers ran" seen per account (and, in the browser, on a second
//     phone);
//   - results in stages: Early results are in once per person for three games, worded by the guard (riley, who sees results
//     straight away, hears who went home; jordan and sam only that they're in), Final scores are in the same way, a show's
//     moment off and classic's own switch off (the bell keeps them), the bell's rows read back through the guard;
//   - the couch's moments: a poll (only to whoever's seen the episode before), a game started (Tell the couch), a watch along
//     planned (each reader's time zone) and called off (once its Undo has passed; an Undo inside it tells nobody), someone joining
//     the couch, a flag settled on the desk, a BINGO called (a couch-mate's, never your own; once);
//   - the bell: its count on the home read, its list, read when it opens, a row past 30 days gone when a new one is written.
//   In a real browser at --width (390 by default), as alex: Settings' What we notify you about (this phone turned on through a
//   stand-in PushManager, a test push reaching it, a moment off with Undo, Couch chat), the hub's bell (its dot, the list, opening
//   reads it, a row opens its page), a show's Notifications in its ⋯ menu. Then the reminder ask (show/remind.tsx; check-new-show.js
//   has the Fan Who Forgets' first save): with his other phone getting them a save doesn't ask; with none, on an iPhone in Safari
//   (no PushManager) a save shows Add to Home Screen's three pictures, Got it leaves the row and its Turn on shows them again; opened
//   from the Home Screen (standalone, a stand-in PushManager) the next save asks again, and Turn on subscribes that phone (a test
//   push reaches it) and the row goes. Nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; .env.local's VAPID keys)
//   node scripts/dev-test/check-new-notify.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); makes zt_nd_kat and the desk's
// zt_nd_desk (both go with the fixture's down); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakePush = require("./fake-push");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-notify runs against a local database only");
if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) throw new Error("check-new-notify needs .env.local's VAPID keys");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-notify.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const OUT6 = "Cristian Chavez";
const NEW_ONLY = ["gameStarted", "planned", "planOff", "poll", "bingoLine", "flagSettled"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rid = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

const quickAnswer = (left, sources = 2) =>
  "Here's what I found:\n```json\n" +
  JSON.stringify({ found: true, episodeTitle: null, left, headline: "A blindside at Tribal.", sources: Array.from({ length: sources }, (_, i) => `https://news${i}.example/ep6`) }) +
  "\n```";
// The full answer: the prompt's own skeleton, everyone answered with high confidence (check-new-backstage.js's, Devin's idol sure).
function fullAnswer(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode six.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  const who = (name) => a.castaways.find((c) => c.name === name);
  Object.assign(who(OUT6), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5 });
  Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  Object.assign(who("Eric Macksoud"), { wonIndividualReward: "yes" });
  Object.assign(who("Devin Way"), { foundAdvantage: "yes", advantageFoundName: "hidden immunity idol" });
  return JSON.stringify(a);
}

async function person(pool, who, role = null) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = rid();
  const name = `zt_nd_${who}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, now(), now())`,
    [id, name, `${name}@example.invalid`, role]
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
  const closers = [];
  const push = await fakePush.start();
  closers.push(push.down);
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const U = fx.users;
    const q = `?couch=${fx.couchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    for (const [who, ui] of [["alex", "new"], ["riley", "classic"], ["jordan", "new"], ["sam", "new"], ["casey", "new"]]) {
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET ui = $2`, [U[who], ui]);
    }
    // Every phone here is the stand-in's: nothing can reach a real push service.
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) {
      const sub = push.subscription(who);
      await pool.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, 'zt notify check')", [U[who], sub.endpoint, sub.p256dh, sub.auth]);
    }
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });
    const profile = async (who) => (await as[who].call("GET", "/api/me/profile")).body;
    const save = (who, body) => as[who].call("PUT", "/api/me/profile", body);
    const home = async (who, tz) => (await as[who].call("GET", `/api/me/home${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`)).body;
    const prefs = async (who) => (await pool.query("SELECT disabled, chat, shows FROM notification_prefs WHERE user_id = $1", [U[who]])).rows[0] ?? { disabled: {}, chat: null, shows: {} };
    const notes = async (who, key) => (await pool.query(`SELECT * FROM notifications WHERE user_id = $1 ${key ? "AND key = $2" : ""} ORDER BY created_at`, key ? [U[who], key] : [U[who]])).rows;
    const got = (who, re) => push.of(who).filter((p) => !re || re.test(p.title));
    // Pushes go after the response: wait for what's expected, then a moment more so a second one (there shouldn't be) would show.
    const expect = async (test, ms = 15000) => {
      const ok = await push.until(test, ms);
      await wait(1500);
      return ok;
    };
    const { rows: showRow } = await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [sid]);
    const showId = showRow[0].show_id;

    // ---------- your time zone ----------
    await home("jordan", "America/Los_Angeles");
    await home("alex", "America/Chicago");
    await as.riley.call("GET", `/api/me?tz=${encodeURIComponent("Europe/London")}`);
    const tzOf = async (who) => (await pool.query("SELECT tz FROM user_settings WHERE user_id = $1", [U[who]])).rows[0]?.tz ?? null;
    check((await tzOf("jordan")) === "America/Los_Angeles" && (await tzOf("riley")) === "Europe/London", "the phone's time zone is kept: from the home read, and from classic's /api/me");
    await home("jordan", "Mars/Olympus_Mons");
    check((await tzOf("jordan")) === "America/Los_Angeles" && (await tzOf("sam")) === null, "a zone the server doesn't know changes nothing; a phone that never said has none");
    await home("alex", "UTC");
    await home("alex", "America/Chicago");

    // ---------- your moments ----------
    let p = await profile("alex");
    check(
      JSON.stringify(p.notify?.moments) === JSON.stringify({ lineup: true, early: true, final: true, invites: true, couch: true, backstage: true }) && p.notify.chat === "quiet" && p.notify.devices === 1,
      "alex: every moment on, Couch chat on Quiet on episode nights (the recommended one), one device",
      JSON.stringify(p.notify)
    );
    for (const [body, what] of [
      [{ notify: { moment: "nope", on: true } }, "a moment there isn't"],
      [{ notify: { moment: "lineup", on: "yes" } }, "on must be true or false"],
      [{ notify: { chat: "loud" } }, "a chat choice there isn't"],
      [{ notify: { moment: "chat", on: false } }, "Couch chat is a choice, not a switch"],
      [{ notify: "lineup" }, "notify must be an object"],
    ]) {
      check((await save("alex", body)).status === 400, `refused: ${what}`);
    }
    let r = await save("alex", { notify: { moment: "lineup", on: false } });
    check(r.status === 200 && r.body.notify.moments.lineup === false, "Lineup reminders off: saved and answered");
    const lineupTypes = ["reminder", "waiverReminder", "draftTurn", "waivers"];
    let pr = await prefs("alex");
    check(lineupTypes.every((t) => pr.disabled[t] === true) && Object.keys(pr.disabled).length === 4, "its four types off in notification_prefs (what classic's switches write)", JSON.stringify(pr.disabled));
    const classicList = (await as.alex.call("GET", "/api/me/notification-prefs")).body;
    const listed = classicList.types.map((t) => t.id);
    check(
      lineupTypes.every((t) => classicList.types.find((x) => x.id === t)?.enabled === false) && NEW_ONLY.every((t) => !listed.includes(t)) && listed.includes("finalScores") && listed.includes("couchJoined"),
      "classic's Account settings agrees, and lists Final scores and New on your couch but not the new design's own",
      listed.join()
    );
    await as.alex.call("PUT", "/api/me/notification-prefs", { enabled: { draftTurn: true } });
    check((await profile("alex")).notify.moments.lineup === true, "classic turns one of its types back on: the moment reads on (it reaches him)");
    r = await save("alex", { notify: { moment: "lineup", on: true } });
    check(Object.keys((await prefs("alex")).disabled).length === 0 && r.body.notify.moments.lineup === true, "on again: all four types on");

    r = await save("sam", { notify: { chat: "all" } });
    pr = await prefs("sam");
    check(r.body.notify.chat === "all" && pr.chat === "all" && !pr.disabled.chat, "sam: Couch chat on Every message", JSON.stringify(pr));
    r = await save("jordan", { notify: { chat: "off" } });
    check(r.body.notify.chat === "off" && (await prefs("jordan")).disabled.chat === true, "jordan: Never (classic's chat switch off)");
    await as.riley.call("PUT", "/api/me/notification-prefs", { enabled: { chat: false } });
    check((await profile("riley")).notify.chat === "off", "classic's League chat off reads as Never");
    await as.riley.call("PUT", "/api/me/notification-prefs", { enabled: { chat: true } });
    check((await profile("riley")).notify.chat === "quiet", "and back on: Quiet on episode nights");

    // A show's own.
    let sn = (await as.sam.call("GET", `/api/seasons/${sid}/notifications`)).body;
    check(
      sn.show === "ZT Survivor" && sn.moments.map((m) => m.id).join() === "lineup,early,final,couch,backstage,chat" && sn.moments.every((m) => m.on && m.here),
      "a show's Notifications: its six moments, all on",
      JSON.stringify(sn).slice(0, 300)
    );
    check((await as.sam.call("PUT", `/api/seasons/${sid}/notifications`, { moment: "invites", on: false })).status === 400, "Invites aren't a show's to switch: 400");
    check((await as.sam.call("GET", `/api/seasons/00000000-0000-4000-8000-000000000000/notifications`)).status === 404, "a season that isn't: 404");
    sn = (await as.sam.call("PUT", `/api/seasons/${sid}/notifications`, { moment: "early", on: false })).body;
    pr = await prefs("sam");
    check(sn.moments.find((m) => m.id === "early").here === false && JSON.stringify(pr.shows[showId]) === '["early"]', "sam: Early results off for ZT Survivor alone", JSON.stringify(pr.shows));
    await save("jordan", { notify: { moment: "final", on: false } });
    check((await as.jordan.call("GET", `/api/seasons/${sid}/notifications`)).body.moments.find((m) => m.id === "final").on === false, "a moment off in Settings is off on the show's sheet too");
    await save("jordan", { notify: { moment: "final", on: true } });

    // ---------- the couch chat ----------
    // Episode 6 is three days off: alex, riley and jordan have seen everything that's aired; sam is on Episode 3, so anything
    // said now is folded for him.
    push.clear();
    r = await as.alex.call("POST", `/api/seasons/${sid}/chat${q}`, { text: "zt notify: what a tribal" });
    check(r.status === 200, "alex says something on the couch chat (the new design)");
    await expect((rs) => rs.some((x) => x.who === "riley") && rs.some((x) => x.who === "sam"));
    let rc = got("riley");
    check(rc.length === 1 && rc[0].body === "zt_nd_alex: zt notify: what a tribal" && rc[0].title === "ZT Survivor 51" && rc[0].url.startsWith("/chat?league="), "riley (classic): who said what, opening classic's chat", JSON.stringify(rc));
    let sc = got("sam");
    check(sc.length === 1 && !sc[0].body.includes("tribal") && /zt_nd_alex sent a message\. It may be about Episode 4/.test(sc[0].body) && sc[0].url === `/show/${sid}/chat`, "sam (Every message, folded): who, never what, opening the show's chat", JSON.stringify(sc));
    check(got("jordan").length === 0 && got("alex").length === 0 && got("casey").length === 0, "jordan (Never), alex (wrote it) and casey (not on this couch) hear nothing");
    check(sc[0].signed && sc[0].ttl === 86400 && sc[0].urgency === "normal", "the push itself: signed with our VAPID key, kept a day");
    check((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE type = 'chat' AND user_id = ANY($1::text[])", [Object.values(U)])).rows[0].n === 0, "a chat message isn't kept in the bell");
    await save("sam", { notify: { chat: "quiet" } });
    push.clear();
    await as.riley.call("POST", `/api/leagues/${L.lineup}/chat`, { text: "zt notify: from classic" });
    await expect((rs) => rs.some((x) => x.who === "alex"));
    const ac = got("alex");
    check(ac.length === 1 && ac[0].body === "zt_nd_riley: zt notify: from classic" && ac[0].url === `/show/${sid}/chat`, "classic's chat reaches alex on the new design, opening the show's chat", JSON.stringify(ac));
    check(got("sam").length === 0, "sam on Quiet on episode nights: a folded message isn't pushed at all");
    // A show the couch only watches: alex follows the Traitors now (through its end); riley follows it on classic.
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, following, private, seen_through) VALUES ($1, $2, true, false, 12)
       ON CONFLICT (user_id, season_id) DO UPDATE SET following = true, private = false, seen_through = 12`,
      [U.alex, fx.traitorsSeasonId]
    );
    push.clear();
    await save("jordan", { notify: { chat: "all" } });
    r = await as.jordan.call("POST", `/api/seasons/${fx.traitorsSeasonId}/chat${q}`, { text: "zt notify: the Traitors though" });
    check(r.status === 200, "jordan says something on a show the couch only watches");
    await expect((rs) => rs.some((x) => x.who === "alex"));
    const tc = got("alex");
    check(tc.length === 1 && tc[0].body === "zt_nd_jordan: zt notify: the Traitors though" && tc[0].url === `/show/${fx.traitorsSeasonId}/chat`, "alex follows it: he hears (watch-only chat pushed nobody before)", JSON.stringify(tc));
    check(got("riley").length === 0, "riley follows it on classic, which can't show that conversation: nothing");
    // A show's chat switched off.
    await as.alex.call("PUT", `/api/seasons/${sid}/notifications`, { moment: "chat", on: false });
    push.clear();
    await as.riley.call("POST", `/api/leagues/${L.outlast}/chat`, { text: "zt notify: anyone?" });
    await expect((rs) => rs.some((x) => x.who === "jordan"));
    check(got("alex").length === 0 && got("jordan").length === 1, "alex turned ZT Survivor's chat off: not him (jordan, Every message, hears)");
    await as.alex.call("PUT", `/api/seasons/${sid}/notifications`, { moment: "chat", on: true });
    check(!(await prefs("alex")).shows[showId], "on again: nothing left switched off for the show");
    await save("jordan", { notify: { chat: "quiet" } });

    // ---------- waivers: a run, and Tonight's "Waivers ran" seen per account ----------
    push.clear();
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/waivers${q}`, { leagueId: L.outlast, action: "run" });
    check(r.status === 200, "alex runs Outlast's waivers from Backstage", JSON.stringify(r.body).slice(0, 200));
    await expect((rs) => rs.some((x) => x.who === "alex"));
    const wa = got("alex");
    check(wa.length === 1 && /replace|Waivers/.test(wa[0].title) && wa[0].url === `/show/${sid}/waivers`, "alex owes Carter's replacement: told, opening the show's Waivers page", JSON.stringify(wa));
    let wv = (await as.alex.call("GET", `/api/seasons/${sid}/waivers${q}`)).body;
    const cup = wv.games.find((g) => g.leagueId === L.outlast);
    check(cup?.stage === "processed" && !!cup.run && Array.isArray(wv.seen) && wv.seen.length === 0, "the waivers read: Outlast's run, not watched yet", JSON.stringify({ stage: cup?.stage, seen: wv.seen }));
    check((await as.alex.call("POST", `/api/seasons/${sid}/waivers`, { seen: { leagueId: L.outlast } })).status === 400, "seen needs the game and the week");
    check((await as.casey.call("POST", `/api/seasons/${sid}/waivers`, { seen: { leagueId: L.outlast, periodId: cup.run.periodId } })).status === 404, "casey doesn't play it: 404");
    if (!apiOnly) {
      // Two phones of alex's: watching the run on one takes the plate off the other.
      const phoneA = await open({ user: fixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      const phoneB = await open({ user: fixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(phoneA.close, phoneB.close);
      for (const ph of [phoneA, phoneB]) {
        await ph.page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
        await ph.page.locator("[data-wv-plate]").waitFor({ timeout: 30000 });
      }
      check(true, "both phones: Tonight's Waivers ran plate");
      await phoneA.page.locator("[data-wv-plate]").click();
      await phoneA.page.getByRole("button", { name: "Skip" }).click();
      await phoneA.page.locator("[data-wv-done]").click();
      await phoneA.page.locator("[data-wv-plate]").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
      check((await phoneA.page.locator("[data-wv-plate]").count()) === 0, "phone A watched the run: its plate goes at once");
      await wait(800);
      await phoneB.page.reload({ waitUntil: "load" });
      await phoneB.page.locator("[data-tab=tonight], main").first().waitFor({ timeout: 30000 });
      await wait(2500);
      check((await phoneB.page.locator("[data-wv-plate]").count()) === 0, "phone B: gone there too (it was per device)");
      await phoneA.close();
      await phoneB.close();
    } else {
      await as.alex.call("POST", `/api/seasons/${sid}/waivers`, { seen: { leagueId: L.outlast, periodId: cup.run.periodId } });
    }
    wv = (await as.alex.call("GET", `/api/seasons/${sid}/waivers${q}`)).body;
    check(wv.seen.includes(`${L.outlast}:${cup.run.periodId}`), "kept on his account (waiver_runs_seen)");

    // ---------- results, in stages ----------
    // Episode 6 aired two days ago (the season moved back five days), with nothing in. riley sees results straight away.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
    await save("riley", { hideScores: false });
    await pool.query("INSERT INTO notifications (user_id, type, key, title, body, link, created_at) VALUES ($1, 'reminder', 'zt-old', 'zt an old one', 'x', '/home', now() - interval '31 days')", [U.sam]);
    push.clear();
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: OUT6, how: "Voted Out" }]) });
    check(r.status === 200 && r.body.applied?.games === 3, "alex's quick check: who went home in Episode 6, in all three games", JSON.stringify(r.body).slice(0, 200));
    await expect((rs) => rs.some((x) => x.who === "riley") && rs.some((x) => x.who === "jordan"));
    await wait(2000);
    const re = got("riley");
    check(re.length === 1 && re[0].title === `Episode 6: ${OUT6} went home` && /^ZT Survivor 51 · Final scores the morning after\./.test(re[0].body), "riley (sees results straight away): who went home, once for three games", JSON.stringify(re));
    check(re[0]?.url.startsWith("/episodes?league="), "on classic: classic's Episodes");
    const je = got("jordan");
    check(je.length === 1 && je[0].title === "Episode 6 results are in" && /^ZT Survivor 51 · Reveal when you've watched\./.test(je[0].body) && !JSON.stringify(je).includes("Cristian"), "jordan (seen 5): only that they're in, no name anywhere", JSON.stringify(je));
    check(je[0]?.url === `/show/${sid}/tonight`, "on the new design: the show's Tonight");
    const wl = /Waivers process (.+)\.$/.exec(je[0]?.body || "");
    check(!wl || /P[DS]T$/.test(wl[1]), "a waiver line, if any, in jordan's own zone (Los Angeles)", je[0]?.body);
    check(got("sam").length === 0 && got("alex").length === 0, "sam turned Early results off for the show; alex sent it: no push");
    const bellE = (who) => notes(who, `results:${sid}:6`);
    check((await bellE("sam")).length === 1 && (await bellE("jordan")).length === 1 && (await bellE("riley")).length === 1 && (await bellE("alex")).length === 0, "the bell keeps one for each of them (sam's too), none for alex");
    const rileyRow = (await bellE("riley"))[0];
    check(rileyRow.spoils === 6 && rileyRow.safe?.title === "Episode 6 results are in" && rileyRow.link === `/show/${sid}/tonight`, "riley's names Episode 6, with its safe words beside it", JSON.stringify(rileyRow));
    check((await bellE("sam"))[0].title === "Episode 6 results are in", "sam's is worded for where he is");

    // Final scores: riley switches classic's Final scores off first.
    await as.riley.call("PUT", "/api/me/notification-prefs", { enabled: { finalScores: false } });
    push.clear();
    const fullQ = await as.alex.call("GET", `/api/seasons/${sid}/backstage/prompt${q}&episode=6&kind=full`);
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "full", answer: fullAnswer(fullQ.body.prompt) });
    check(r.status === 200, "the full results go in", JSON.stringify(r.body).slice(0, 200));
    await expect((rs) => rs.some((x) => x.who === "jordan") && rs.some((x) => x.who === "sam"));
    const jf = got("jordan");
    const sf = got("sam");
    check(jf.length === 1 && jf[0].title === "Episode 6 final scores are in" && /Reveal when you've watched/.test(jf[0].body), "jordan: Final scores are in, once", JSON.stringify(jf));
    check(sf.length === 1 && sf[0].title === "Episode 6 final scores are in" && !JSON.stringify(sf).includes("Cristian"), "sam (final not switched off): Final scores are in, no names", JSON.stringify(sf));
    check(got("riley").length === 0 && (await notes("riley", `final:${sid}:6`)).length === 1, "riley switched it off in classic: no push, but his bell keeps it");
    // The bell, read back through the guard: riley hides scores again, on Episode 5.
    await save("riley", { hideScores: true });
    const rb = (await as.riley.call("GET", "/api/me/notifications")).body;
    const early = rb.notes.find((n) => n.moment === "early");
    check(early?.title === "Episode 6 results are in" && !JSON.stringify(rb).includes("Cristian"), "riley's bell now: the safe words, not who went home", JSON.stringify(early));

    // ---------- the couch's moments ----------
    for (const who of ["alex", "jordan"]) await as[who].call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.couchId });
    push.clear();
    r = await as.jordan.call("POST", `/api/seasons/${sid}/polls${q}`, { question: "zt notify: who goes next?", cast: true });
    check(r.status === 200, "jordan starts a poll on Episode 7", JSON.stringify(r.body).slice(0, 160));
    await expect((rs) => rs.some((x) => x.who === "alex"));
    const ap = got("alex");
    check(ap.length === 1 && ap[0].title === "zt_nd_jordan started a poll" && ap[0].body === "ZT Survivor 51 · Episode 7: zt notify: who goes next?" && ap[0].url === `/show/${sid}/tonight`, "alex (seen 6) hears", JSON.stringify(ap));
    check(got("sam").length === 0 && (await notes("sam")).every((n) => n.type !== "poll"), "sam (on 3) may not see it: neither pushed nor kept");
    check(got("riley").length === 0, "riley (on 5) neither");

    push.clear();
    const startOpts = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    const fit = startOpts.games.find((g) => g.fits && !g.soon && g.type);
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: fit?.key, tell: true });
    check(r.status === 200 && r.body.told === 3, `jordan starts ${fit?.name} and tells the couch`, JSON.stringify(r.body).slice(0, 200));
    await expect((rs) => rs.some((x) => x.who === "alex") && rs.some((x) => x.who === "sam"));
    const gs = [...got("alex"), ...got("sam")];
    check(gs.length === 2 && gs.every((x) => x.title === "zt_nd_jordan started a game for ZT Survivor" && x.url === `/show/${sid}/games`), "alex and sam hear, to the Games tab (its own moment now: On the couch)", JSON.stringify(gs));
    check(got("riley").length === 0 && (await notes("riley")).some((n) => n.type === "gameStarted"), "riley is on classic, which can't join it: not pushed, kept in his bell");

    // A watch along: jordan's phone is in Los Angeles, sam's says nothing (the season's Eastern time), riley's is classic.
    push.clear();
    const opts = (await as.alex.call("GET", `/api/seasons/${sid}/plans${q}`)).body;
    const ep7 = opts.episodes.find((e) => e.number === 7);
    r = await as.alex.call("POST", `/api/seasons/${sid}/plans${q}`, { episode: 7, how: "live", invite: [U.riley, U.jordan, U.sam] });
    check(r.status === 200 && !!ep7, "alex plans Episode 7's live airing for riley, jordan and sam", JSON.stringify(r.body).slice(0, 160));
    const plan1 = r.body.plan;
    await expect((rs) => rs.some((x) => x.who === "jordan") && rs.some((x) => x.who === "sam"));
    const zone = (tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(ep7.airAt)).replace(", ", " ");
    const jp = got("jordan");
    const sp = got("sam");
    check(jp.length === 1 && jp[0].title === "zt_nd_alex planned a watch along" && jp[0].body.includes(zone("America/Los_Angeles")), `jordan's says ${zone("America/Los_Angeles")}: his own time`, JSON.stringify(jp));
    check(sp.length === 1 && sp[0].body.includes(zone("America/New_York")), `sam's says ${zone("America/New_York")}: the season's`, JSON.stringify(sp));
    check(got("riley").length === 0, "riley (classic) isn't pushed a watch along");
    push.clear();
    r = await as.alex.call("POST", `/api/plans/${plan1.id}`, { cancel: true });
    check(r.status === 200, "alex calls it off");
    await wait(4000);
    check(push.received.length === 0, "nobody hears inside its Undo");
    await expect((rs) => rs.some((x) => x.who === "jordan") && rs.some((x) => x.who === "sam"), 15000);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" }).format(new Date(ep7.airAt));
    const off = got("jordan");
    check(off.length === 1 && off[0].title === `zt_nd_alex called off ${day}'s watch along` && off[0].body === "ZT Survivor 51 · Episode 7.", "once it's passed, jordan and sam hear it's off", JSON.stringify(off));
    push.clear();
    r = await as.alex.call("POST", `/api/seasons/${sid}/plans${q}`, { episode: 7, how: "live", invite: [U.jordan] });
    const plan2 = r.body.plan;
    await expect((rs) => rs.some((x) => x.who === "jordan"));
    push.clear();
    await as.alex.call("POST", `/api/plans/${plan2.id}`, { cancel: true });
    await wait(1200);
    await as.alex.call("POST", `/api/plans/${plan2.id}`, { cancel: false });
    await wait(10000);
    check(push.received.length === 0, "called off and Undone inside its 5 s: nobody hears");

    // Someone joins the couch.
    const katId = await person(pool, "kat");
    as.kat = await api({ user: "zt_nd_kat", pass: PASSWORD });
    const code = (await as.alex.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code;
    push.clear();
    r = await as.kat.call("POST", "/api/couches/join", { code });
    check(r.status === 200 && r.body.already === false, "kat joins the couch with alex's code");
    await expect((rs) => ["alex", "riley", "jordan", "sam"].every((w) => rs.some((x) => x.who === w)));
    const joined = ["alex", "riley", "jordan", "sam"].map((w) => got(w));
    check(joined.every((g) => g.length === 1 && g[0].title === "zt_nd_kat joined ZT Survivor 51"), "everyone on it hears (Invites and join requests)", JSON.stringify(joined.map((g) => g.map((x) => x.title))));
    check(joined[0][0].url === "/home" && joined[1][0].url === "/", "the hub on the new design, classic's home for riley");
    await as.kat.call("POST", "/api/couches/join", { code });
    await wait(2000);
    check(got("alex").length === 1, "joining again tells nobody");
    check((await notes("sam")).every((n) => n.key !== "zt-old"), "a notice older than 30 days went when a new one was written");

    // A flag, settled on the desk.
    const danny = (await pool.query("SELECT id FROM season_decisions WHERE season_id = $1 AND episode_number = 6 AND castaway_name = 'Danny Kilby' AND event_type = 'individualImmunity'", [sid])).rows[0]?.id;
    r = await as.jordan.call("POST", `/api/seasons/${sid}/disputes${q}`, { episode: 6, decisionId: danny, reason: "wrong-person" });
    check(r.status === 200, "jordan flags Danny's immunity", JSON.stringify(r.body));
    const deskId = await person(pool, "desk", "admin");
    as.desk = await api({ user: "zt_nd_desk", pass: PASSWORD });
    push.clear();
    r = await as.desk.call("POST", `/api/desk/facts/${danny}`, { decide: "no" });
    check(r.status === 200 && r.body.status === "removed", "the desk decides it didn't happen", JSON.stringify(r.body).slice(0, 160));
    await expect((rs) => rs.some((x) => x.who === "jordan"));
    const fl = got("jordan");
    check(
      fl.length === 1 && fl[0].title === "You were right about Episode 6" && fl[0].body === "ZT Survivor 51 · Danny Kilby · individual immunity: every game has it put right." && fl[0].url === `/show/${sid}/episodes`,
      "jordan hears how his flag went",
      JSON.stringify(fl)
    );
    check((await pool.query("SELECT told_at FROM fact_disputes WHERE decision_id = $1", [danny])).rows.every((x) => x.told_at), "told once (fact_disputes.told_at)");

    // A bingo line: the squares either side of the free one in the middle row of jordan's card on Episode 6 (the fixture's bank,
    // docs/PLAN-bingo-bank.md). A bank's square counts once two on the couch say it happened: alex says so of both (a say of his own,
    // in the table the couch's says go in), and jordan's ticks are the second say.
    const card = (await as.jordan.call("GET", `/api/seasons/${sid}/bingo/6${q}`)).body;
    check(card.status === "open" && card.squares?.[4]?.key === "free" && Array.isArray(card.truth), "jordan's card on Episode 6 is open, the middle square free", JSON.stringify(card).slice(0, 160));
    for (const i of [3, 5]) {
      await pool.query("INSERT INTO episode_call_says (user_id, season_id, episode, question, happened) VALUES ($1, $2, 6, $3, true) ON CONFLICT DO NOTHING", [U.alex, sid, card.squares[i].key]);
    }
    check((await as.jordan.call("GET", `/api/seasons/${sid}/bingo/6${q}`)).body.truth.filter((t, i) => [3, 5].includes(i)).every((t) => t === null), "its middle row: alex says it happened, one say each so far");
    await as.alex.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { square: 0, ticked: true });
    push.clear();
    await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { square: 3, ticked: true });
    await wait(2500);
    check(push.received.length === 0, "one square of the line: nothing yet");
    r = await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { square: 5, ticked: true });
    check(r.body.lines?.ticked === 1 && r.body.lines.called === 0, "the second: a line made, not called yet", JSON.stringify(r.body.lines));
    await wait(2500);
    check(push.received.length === 0, "a line made tells nobody: calling it does (docs/PLAN-bingo-bank.md step 3)");
    r = await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { call: 1 });
    check(r.status === 200 && r.body.lines?.standing === 1, "jordan calls BINGO: his line counts (alex says, jordan ticks)", JSON.stringify(r.body.lines));
    await expect((rs) => rs.some((x) => x.who === "alex"));
    await wait(1500);
    check(
      got("alex").length === 1 && got("alex")[0].title === "zt_nd_jordan called BINGO" && got("alex")[0].body === "ZT Survivor 51 · Episode 6 · Look at their card",
      "alex (playing that episode on the couch): zt_nd_jordan called BINGO · Look at their card",
      JSON.stringify(got("alex"))
    );
    check(got("jordan").length === 0, "jordan isn't told of his own call", JSON.stringify(got("jordan")));
    check(got("sam").length === 0 && got("riley").length === 0, "sam and riley have no card on it (and haven't seen it): nothing");
    push.clear();
    await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { square: 5, ticked: false });
    await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { square: 5, ticked: true });
    await as.jordan.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { call: 1 });
    await wait(3000);
    check(push.received.length === 0, "unticked, ticked and called again: told once");

    // ---------- the bell ----------
    const hs = await home("sam");
    const sb = (await as.sam.call("GET", "/api/me/notifications")).body;
    check(hs.notes?.unread === sb.notes.length && sb.notes.length >= 4 && sb.notes.every((n) => n.unread) && sb.readAt === null, `sam's bell: ${sb.notes.length} new, the home read's count the same`, JSON.stringify({ unread: hs.notes, n: sb.notes.length }));
    check(sb.notes[0].at >= sb.notes[sb.notes.length - 1].at && sb.notes.some((n) => n.art === "/mock/showcase/art/survivor.jpg"), "newest first, with the show's art");
    check(!JSON.stringify(sb).includes("Cristian") && !JSON.stringify(sb).includes("Danny"), "nothing in it past where sam is");
    check((await as.sam.call("POST", "/api/me/notifications", { read: true })).status === 200 && (await home("sam")).notes.unread === 0, "read: the count goes");
    check((await as.sam.call("GET", "/api/me/notifications")).body.notes.every((n) => !n.unread), "and the list says so");
    check((await fetch(`${BASE}/api/me/notifications`)).status === 401, "signed out: 401");

    // ---------- the browser ----------
    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(st);
        });
      };
      // This phone's PushManager, standing in for the browser's: Turn on gets a subscription to fake-push (never a real push
      // service), kept across page loads.
      const phone = push.subscription("alex-phone");
      const stubPush = (s) => {
        const key = "zt-notify-subscribed";
        const make = () => ({ endpoint: s.endpoint, expirationTime: null, toJSON: () => ({ endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } }), unsubscribe: async () => (localStorage.removeItem(key), true) });
        PushManager.prototype.subscribe = async function () {
          localStorage.setItem(key, "1");
          return make();
        };
        PushManager.prototype.getSubscription = async function () {
          return localStorage.getItem(key) ? make() : null;
        };
      };
      let n = 0;
      const b = await open({ user: fixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(b.close);
      const pg = b.page;
      await pg.context().addInitScript(noBadge);
      await pg.context().addInitScript(stubPush, phone);
      await pg.context().grantPermissions(["notifications"], { origin: BASE });
      await pg.emulateMedia({ reducedMotion: "reduce" });
      let favicon = 0;
      pg.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
      const errors = () => b.errors.filter((e) => !(favicon && /Failed to load resource/.test(e)));
      const shot = async (name) => {
        await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
        await pg.waitForTimeout(250);
        await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-alex-${name}.png`) });
      };
      const wide = async (what) => {
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what} fits ${width}px`, `${over}px over`);
      };
      const toasted = async (re) => {
        try {
          await pg.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
          return true;
        } catch {
          return false;
        }
      };
      const sheet = pg.locator("[role=dialog][data-open]");

      // Settings: What we notify you about.
      await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
      await pg.locator("[data-settings-notify]").waitFor({ timeout: 30000 });
      await pg.locator("[data-phone=off]").waitFor({ timeout: 15000 });
      await pg.waitForTimeout(800);
      const switches = await pg.locator("[data-settings-notify] [data-setting]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-setting")}:${e.getAttribute("aria-checked")}`));
      check(
        switches.join() === "moment-lineup:true,moment-early:true,moment-final:true,moment-invites:true,moment-couch:true,moment-backstage:true",
        "the moments in the mock's order, then On the couch and (he runs games) Backstage, all on",
        switches.join()
      );
      check((await pg.locator("[data-choice=chat-quiet]").getAttribute("aria-checked")) === "true", "Couch chat: Quiet on episode nights");
      check((await pg.locator("[data-preview]").count()) === 0, "no Preview left in it (part 4 made Appearance real)");
      await pg.evaluate(() => {
        const top = document.querySelector("[data-settings-notify]").parentElement.getBoundingClientRect().top;
        window.scrollBy(0, top - 70);
      });
      await wide("Settings");
      await shot("settings-notify");
      await pg.locator("[data-settings-notify]").scrollIntoViewIfNeeded();
      await pg.locator("[data-phone-toggle]").click();
      check(await toasted(/On for this phone/), "Turn on: this phone is subscribed");
      await pg.locator("[data-phone=on]").waitFor({ timeout: 10000 });
      const subRow = (await pool.query("SELECT user_id FROM push_subscriptions WHERE endpoint = $1", [phone.endpoint])).rows[0];
      check(subRow?.user_id === U.alex, "its subscription is his (the stand-in's endpoint)");
      push.clear();
      await as.alex.call("POST", "/api/me/push-test", {});
      await expect((rs) => rs.some((x) => x.who === "alex-phone"));
      check(got("alex-phone").length === 1 && got("alex-phone")[0].url === "/settings", "a test push reaches this phone, opening Settings (he's on the new design)");
      await shot("settings-phone-on");
      await pg.locator("[data-setting=moment-couch]").click();
      check(await toasted(/On the couch: off/), "On the couch off: saved");
      const offTypes = (await prefs("alex")).disabled;
      check(["gameStarted", "planned", "planOff", "poll", "newBet", "bingoLine"].every((t) => offTypes[t] === true), "its six types are off on his account", JSON.stringify(offTypes));
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction(() => document.querySelector("[data-setting=moment-couch]")?.getAttribute("aria-checked") === "true", null, { timeout: 15000 }).catch(() => {});
      check(!(await prefs("alex")).disabled.poll, "Undo: on again");
      await pg.locator("[data-choice=chat-all]").click();
      check(await toasted(/Couch chat: Every message/), "Couch chat: Every message, saved");
      check((await prefs("alex")).chat === "all", "kept");
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction(() => document.querySelector("[data-choice=chat-quiet]")?.getAttribute("aria-checked") === "true", null, { timeout: 15000 }).catch(() => {});
      check((await prefs("alex")).chat === null, "Undo: back to Quiet on episode nights");
      await pg.locator("[data-phone-toggle]").click();
      check(await toasted(/Off for this phone/), "Turn off: this phone only");
      check((await pool.query("SELECT 1 FROM push_subscriptions WHERE endpoint = $1", [phone.endpoint])).rows.length === 0, "its subscription is gone; his other phone's stays");
      // Nothing reaching him: with no phone of his on (this one off, his other one gone for a moment), the switches say so
      // instead of reading as reminders that are coming (the 2026-10-26 critique's P0).
      check((await pg.locator("[data-notify-quiet]").count()) === 0, "his other phone still gets them: no 'none of these reach you'");
      const other = push.subscription("alex");
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [other.endpoint]);
      await pg.reload({ waitUntil: "load" });
      await pg.locator("[data-notify-quiet=off]").waitFor({ timeout: 15000 }).catch(() => {});
      check(
        /None of these reach you yet.*turn notifications on above/.test((await pg.locator("[data-notify-quiet]").textContent().catch(() => "")) || ""),
        "no phone of his on: the switches say none of these reach him yet, and how they start"
      );
      await pg.locator("[data-notify-quiet]").scrollIntoViewIfNeeded().catch(() => {});
      await shot("settings-none-reach");
      await pg.locator("[data-phone-toggle]").click();
      await pg.locator("[data-phone=on]").waitFor({ timeout: 10000 });
      await pg.waitForFunction(() => !document.querySelector("[data-notify-quiet]"), null, { timeout: 10000 }).catch(() => {});
      check((await pg.locator("[data-notify-quiet]").count()) === 0, "turned on here: the line goes");
      await pg.locator("[data-phone-toggle]").click();
      await pg.locator("[data-phone=off]").waitFor({ timeout: 10000 });
      await pool.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, 'zt notify check')", [U.alex, other.endpoint, other.p256dh, other.auth]);

      // The hub's bell.
      const unread = (await home("alex")).notes.unread;
      await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      await pg.locator("[data-bell]").waitFor({ timeout: 30000 });
      await pg.waitForFunction((n0) => document.querySelector("[data-bell]")?.getAttribute("data-unread") === String(n0), unread, { timeout: 15000 }).catch(() => {});
      check(unread > 0 && (await pg.locator("[data-bell]").getAttribute("aria-label")) === `Notifications: ${unread} new`, `the bell: ${unread} new, from the home read`);
      await pg.waitForTimeout(800);
      await shot("hub-bell");
      await pg.locator("[data-bell]").click();
      await pg.locator("[data-notes-sheet] [data-note]").first().waitFor({ timeout: 15000 });
      await pg.waitForTimeout(600);
      const rows = await pg.locator("[data-note]").count();
      const fresh = await pg.locator("[data-note][data-unread='1']").count();
      check(rows === unread && fresh === unread, `the list: ${rows} rows, each marked new`, `${rows} rows, ${fresh} new, ${unread} on the home read`);
      check(new RegExp(`${unread} new`).test(await sheet.innerText()), "its line says how many are new");
      const dueN = (await home("alex")).moves.length;
      const dueRow = (await pg.locator("[data-notes-due]").count()) ? await pg.locator("[data-notes-due]").getAttribute("data-notes-due") : null;
      check(
        dueN ? dueRow === String(dueN) && new RegExp(`${dueN} moves? due`).test(await pg.locator("[data-notes-due]").innerText()) : dueRow === null,
        dueN ? `above the list, what's still his to do: ${dueN} due (nothing new isn't nothing due)` : "nothing due: no due row",
        `${dueRow} vs ${dueN}`
      );
      await wide("the bell");
      await shot("bell");
      await pg.waitForFunction(() => document.querySelector("[data-bell]")?.getAttribute("data-unread") === "0", null, { timeout: 15000 }).catch(() => {});
      check((await pg.locator("[data-bell]").getAttribute("data-unread")) === "0" && (await home("alex")).notes.unread === 0, "opening it reads them: the dot goes");
      const first = pg.locator("[data-note]").filter({ hasText: "started a poll" }).first();
      await first.click();
      await pg.waitForURL((u) => u.pathname === `/show/${sid}/tonight`, { timeout: 20000 }).catch(() => {});
      check(new URL(pg.url()).pathname === `/show/${sid}/tonight`, "a row opens where it's about (the poll: the show's Tonight)", pg.url());

      // A show's Notifications.
      await pg.locator("button[aria-label^='Show menu']").first().waitFor({ timeout: 30000 });
      await pg.waitForTimeout(800);
      await pg.locator("button[aria-label^='Show menu']").first().click();
      await sheet.getByRole("button", { name: /^Notifications/ }).click();
      await pg.locator("[data-show-notify] [data-setting=show-lineup]").waitFor({ timeout: 15000 });
      await pg.waitForTimeout(500);
      const showSwitches = await pg.locator("[data-show-notify] [data-setting]").evaluateAll((els) => els.map((e) => e.getAttribute("data-setting")));
      check(showSwitches.join() === "show-lineup,show-early,show-final,show-couch,show-backstage,show-chat", "its sheet: the show's six moments", showSwitches.join());
      check(/Quiet on episode nights for every show, in Settings/.test(await pg.locator("[data-setting=show-chat]").innerText()), "its chat row says what Settings has it on");
      await pg.locator("[data-setting=show-chat]").click();
      check(await toasted(/Couch chat: off for ZT Survivor/), "chat off for ZT Survivor: saved");
      check(JSON.stringify((await prefs("alex")).shows[showId]) === '["chat"]', "kept for this show alone");
      await wide("a show's Notifications");
      await shot("show-notify");
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction(() => document.querySelector("[data-setting=show-chat]")?.getAttribute("aria-checked") === "true", null, { timeout: 15000 }).catch(() => {});
      check(!(await prefs("alex")).shows[showId], "Undo: on again");
      // The reminder ask. His other phone gets them (it's back), so a save here doesn't ask.
      const changePick = async (p) => {
        await p.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
        await p.locator("[data-tab=tonight]").waitFor({ timeout: 30000 });
        await p.waitForTimeout(1000);
        await p.locator('[data-move^="pick-"] button, [data-done^="pick-done"] button').first().click();
        const d = p.getByRole("dialog");
        await d.getByText("Your moves").waitFor({ timeout: 15000 });
        const tab = d.getByRole("tab", { name: "Survival Pool" });
        if (await tab.count()) await tab.click();
        await d.locator('[data-pick]:not([disabled])[aria-pressed="false"]').first().click();
        await d.getByRole("button", { name: "Save" }).click();
        await d.filter({ hasText: "Your moves" }).waitFor({ state: "hidden", timeout: 15000 });
        await p.waitForTimeout(1500);
      };
      const asked = (p) => p.evaluate((id) => JSON.parse(localStorage.getItem(`gys.remind.${id}`) || "{}").asked ?? null, U.alex);
      await changePick(pg);
      check((await pg.locator("[data-remind-sheet]").count()) === 0 && (await asked(pg)) === null, "his other phone gets them: saving doesn't ask");
      check(errors().length === 0, "alex: no page errors", errors().join(" | "));

      // Nothing reaching him (his other phone gone), on an iPhone in Safari: no PushManager until it's opened from the Home Screen.
      await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1", [U.alex]);
      const iphone = push.subscription("alex-iphone");
      const onIphone = (s) => {
        Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
        let installed = false;
        try {
          installed = !!localStorage.getItem("zt-installed");
        } catch {
          /* about:blank */
        }
        if (!installed) return void delete window.PushManager;
        Object.defineProperty(navigator, "standalone", { get: () => true });
        const key = "zt-notify-subscribed";
        const make = () => ({ endpoint: s.endpoint, expirationTime: null, toJSON: () => ({ endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } }), unsubscribe: async () => (localStorage.removeItem(key), true) });
        PushManager.prototype.subscribe = async function () {
          localStorage.setItem(key, "1");
          return make();
        };
        PushManager.prototype.getSubscription = async function () {
          return localStorage.getItem(key) ? make() : null;
        };
      };
      const b2 = await open({ user: fixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(b2.close);
      const ip = b2.page;
      await ip.context().addInitScript(noBadge);
      await ip.context().addInitScript(onIphone, iphone);
      await ip.context().grantPermissions(["notifications"], { origin: BASE });
      await ip.emulateMedia({ reducedMotion: "reduce" });
      await changePick(ip);
      const ask = ip.locator("[data-remind-sheet]");
      await ask.waitFor({ timeout: 10000 }).catch(() => {});
      check((await ask.getAttribute("data-remind-sheet").catch(() => null)) === "install", "an iPhone in Safari: the save asks with Add to Home Screen, not Turn on");
      const art = ask.locator("img");
      await ip.waitForFunction(() => document.querySelector("[data-remind-sheet] img")?.complete, null, { timeout: 10000 }).catch(() => {});
      check((await art.evaluate((i) => i.naturalWidth > 0).catch(() => false)) && /add-to-home-screen/.test((await art.getAttribute("src")) || ""), "its three pictures load (the placeholder art)");
      check(/Tap Share.*Add to Home Screen.*Open it from there/s.test(await ask.innerText()) && (await ask.locator("[data-remind-on]").count()) === 0, "one line under each picture, numbered, and no Turn on");
      check((await asked(ip))?.as === "install", "remembered: asked, for the Home Screen");
      await wide("the iPhone's ask");
      await ip.waitForTimeout(400);
      await ip.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-alex-remind-iphone.png`) });
      await ask.locator("[data-remind-got]").click();
      await ask.waitFor({ state: "hidden", timeout: 10000 });
      const row = ip.locator("[data-remind-row]");
      await row.waitFor({ timeout: 10000 }).catch(() => {});
      // "slipped" where a move of his for the last episode he's seen never came in (his Episode 6 pick, here), else "ask".
      const rowKind = await row.getAttribute("data-remind-row").catch(() => null);
      check(rowKind === "ask" || rowKind === "slipped", `Got it: the row under the heading (${rowKind}), since nothing reaches him yet`);
      await row.locator("[data-remind-row-on]").click();
      await ask.waitFor({ timeout: 10000 }).catch(() => {});
      check((await ask.getAttribute("data-remind-sheet").catch(() => null)) === "install", "the row's Turn on shows the pictures again");
      await ask.locator("[data-remind-later]").click();
      await ask.waitFor({ state: "hidden", timeout: 10000 });

      // Opened from the Home Screen: notifications can work now, so the next save asks again, and Turn on turns this phone on.
      await ip.evaluate(() => localStorage.setItem("zt-installed", "1"));
      await changePick(ip);
      await ask.waitFor({ timeout: 10000 }).catch(() => {});
      check((await ask.getAttribute("data-remind-sheet").catch(() => null)) === "off", "opened from the Home Screen: the next save asks again, with Turn on");
      await ip.waitForTimeout(400);
      await ip.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-alex-remind-installed.png`) });
      await ask.locator("[data-remind-on]").click();
      await ip.waitForFunction(() => /On for this phone/.test(document.querySelector("[role=status]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
      await ask.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
      check((await pool.query("SELECT user_id FROM push_subscriptions WHERE endpoint = $1", [iphone.endpoint])).rows[0]?.user_id === U.alex, "Turn on: this iPhone is subscribed");
      check((await row.count()) === 0, "and the row goes");
      push.clear();
      await as.alex.call("POST", "/api/me/push-test", {});
      await expect((rs) => rs.some((x) => x.who === "alex-iphone"));
      check(got("alex-iphone").length === 1, "a test push reaches it");
      await ip.goto(`${BASE}/settings`, { waitUntil: "load" });
      await ip.locator("[data-phone=on]").waitFor({ timeout: 15000 }).catch(() => {});
      check((await ip.locator("[data-phone=on]").count()) === 1 && (await ip.locator("[data-notify-quiet]").count()) === 0, "Settings agrees: on for this phone, nothing about none reaching him");
      check(b2.errors.length === 0, "the iPhone: no page errors", b2.errors.join(" | "));
    }
    void katId;
    void deskId;
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
