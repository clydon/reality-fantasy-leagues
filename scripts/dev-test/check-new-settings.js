// Dev-only check for Settings and your profile (docs/PLAN-new-design.md step 15 part 1), against the dev server, on
// new-fixture.js's couch ("ZT Survivor 51": alex owns it, riley, jordan and sam on it) and its "ZT Extra" (alex and casey).
//   API:
//   - your profile: name, colour, picture, AI, Hide scores until I reveal, since, your account (sign-in name, email, password,
//     Google only when it's set up); refusals (a colour off the palette, an AI we don't open, a name that's taken, too short,
//     a picture of the wrong kind or too big);
//   - one name: a new name is your username (kept in lower case), your seat in every league you play (not where someone
//     else there goes by it already) and the name on your messages; everyone's table says it;
//   - one face: your colour and picture on your own home read and on everyone's on your couches; your picture read only by
//     someone on a couch with you (cached for good by its version), gone when you remove it;
//   - hiding scores is the guard's own setting (show_results_immediately): seenThrough null while off;
//   - the couch: only whoever runs it renames it or hands it on (refused for anyone else, and for someone not on it), a
//     new code retires your old one (it stops opening the couch) and leaves everyone else's.
//   In a real browser at --width (390 by default), as alex: Your settings as settings Round 1 built it (you, the plate while
//   nothing reaches him, five groups each with its value: Notifications, When results show, Privacy, Appearance in place, Your
//   shows couches and games; then Account and help with Sign out last; no Your AI, How each game works, Quick settings or folds;
//   44px targets); When results show (Straight away asks first: Keep them hidden, then Show them with Undo; Reset to recommended);
//   a page by its address and closed by Back or the phone's back gesture; the profile sheet (a colour with Undo, a picture shrunk
//   in the browser and shown on every face of his, a taken name refused, a new one saved and shown at once); the hub's gear and
//   the picture's sheet (a Your settings row, no tour); Ask an AI's one ChatGPT link and Copy the question (C8); Your shows,
//   couches and games (the map) opening the couch's page (its chat row, Rename with Undo, a new code, Hand it on); Your account
//   (Change password: a wrong one refused, then changed and changed back; Your phones, its Back naming Your account); Report a
//   problem (a row kept for us). As riley: the map's couch not his to run, alex's picture on his face, no Rename.
//   Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-settings.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only (its names
// all start zt_nd_, so the fixture's down finds them); refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-settings runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-settings.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
// A 1 by 1 PNG: the server keeps what it's sent (the browser makes the real ones small).
const DOT = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const ART = path.join(__dirname, "..", "..", "public", "mock", "showcase", "art", "survivor.jpg");

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
    const sid = fx.seasonId;
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });
    const profile = async (who) => (await as[who].call("GET", "/api/me/profile")).body;
    const save = (who, body) => as[who].call("PUT", "/api/me/profile", body);
    const home = async (who) => (await as[who].call("GET", "/api/me/home")).body;
    const memberIn = (h, couchId, userId) => h.couches.find((c) => c.id === couchId)?.members.find((m) => m.userId === userId);
    const seatNames = async (leagueId) => (await pool.query("SELECT state->'players' AS p FROM leagues WHERE id = $1", [leagueId])).rows[0].p.map((p) => p.name);
    const A = fx.users.alex;

    // ---------- your profile ----------
    let p = await profile("alex");
    check(
      p.name === "zt_nd_alex" && p.colour === null && p.picture === null && !("ai" in p) && p.hideScores === true && p.since === "ZT Survivor 51",
      "alex's profile: his name, no colour or picture chosen, no AI setting (settings Round 1, C8), scores hidden, since ZT Survivor 51",
      JSON.stringify(p)
    );
    check(p.account.username === "zt_nd_alex" && p.account.email === "zt_nd_alex@example.invalid" && p.account.password === true, "his account: signs in as zt_nd_alex, with a password and an email", JSON.stringify(p.account));
    check(p.account.google.available === !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && p.account.google.linked === false, "Google: offered only once it's set up, and not linked", JSON.stringify(p.account.google));
    check((await as.alex.call("GET", "/api/me/profile")).status === 200 && (await fetch(`${BASE}/api/me/profile`)).status === 401, "signed out: 401");

    let r = await save("alex", { colour: "#123456" });
    check(r.status === 400, "a colour off the palette: 400", JSON.stringify(r.body));
    r = await save("alex", { ai: "grok" });
    check(r.status === 400, "Your AI for results is gone (C8): an AI alone is nothing to change, 400");
    check((await save("alex", {})).status === 400, "nothing to change: 400");
    r = await save("alex", { colour: "#a76bb0" });
    check(r.status === 200 && r.body.colour === "#a76bb0", "Orchid, saved and answered", JSON.stringify(r.body));
    const s = (await pool.query("SELECT colour FROM user_settings WHERE user_id = $1", [A])).rows[0];
    check(s.colour === "#a76bb0", "kept in user_settings");
    let h = await home("alex");
    check(h.user.colour === "#a76bb0" && h.user.picture === null, "his own home read carries his colour", JSON.stringify(h.user));
    check(memberIn(await home("riley"), fx.couchId, A)?.colour === "#a76bb0", "riley's home: alex's face is Orchid");
    check(memberIn(await home("casey"), fx.extraCouchId, A)?.colour === "#a76bb0", "and casey's, on ZT Extra");
    r = await save("alex", { colour: null });
    check(r.status === 200 && r.body.colour === null, "no colour: back to the one his id picks");

    // ---------- Hide scores until I reveal ----------
    r = await save("alex", { hideScores: "no" });
    check(r.status === 400, "hideScores must be true or false");
    r = await save("alex", { hideScores: false });
    const immediate = async () => (await pool.query("SELECT show_results_immediately FROM user_settings WHERE user_id = $1", [A])).rows[0].show_results_immediately;
    check(r.status === 200 && r.body.hideScores === false && (await immediate()) === true, "off: the account sees results straight away (show_results_immediately)");
    check((await home("alex")).shows.find((x) => x.seasonId === sid)?.seenThrough === null, "so the guard lets everything out on the season he plays (seenThrough null)");
    r = await save("alex", { hideScores: true });
    check(r.body.hideScores === true && (await immediate()) === false && (await home("alex")).shows.find((x) => x.seasonId === sid)?.seenThrough === 5, "on again: back to Episode 5");
    // Settings Round 1 (C1): Straight away means every show, one you only follow too (riley follows the Traitors, through Ep 2).
    const traitors = async () => (await home("riley")).shows.find((x) => x.seasonId === fx.traitorsSeasonId)?.seenThrough;
    check((await traitors()) === 2, "riley, waiting until she's watched: the Traitors she only follows goes by her mark (Ep 2)");
    await save("riley", { hideScores: false });
    check((await traitors()) === null, "Straight away: everything on the Traitors too, a show she doesn't play");
    await save("riley", { hideScores: true });
    check((await traitors()) === 2, "back to waiting: Ep 2 again");

    // ---------- notifications (settings Round 1) ----------
    p = await profile("alex");
    check(
      Object.keys(p.notify.moments).sort().join() === "couch,invites,lineup,results" && p.notify.moments.invites === true,
      "the moments: reminders, results (one switch), your couch, and invites (always on)",
      JSON.stringify(p.notify.moments)
    );
    check((await save("alex", { notify: { moment: "invites", on: false } })).status === 400, "invites have no switch: 400");
    check((await save("alex", { notify: { moment: "backstage", on: false } })).status === 400, "Backstage's switch is gone (C4): 400");
    r = await save("alex", { notify: { moment: "results", on: false } });
    const disabled = (await pool.query("SELECT disabled FROM notification_prefs WHERE user_id = $1", [A])).rows[0].disabled;
    check(r.body.notify.moments.results === false && disabled.episodeResults && disabled.finalScores, "Results off: early and final both off, one switch (C2)", JSON.stringify(disabled));
    await pool.query("UPDATE notification_prefs SET disabled = '{\"episodeResults\": true}'::jsonb WHERE user_id = $1", [A]);
    check((await profile("alex")).notify.moments.results === false, "a mix (classic turned one type off) reads as off, never a switch that lies");
    r = await save("alex", { notify: { moment: "results", on: true } });
    check(r.body.notify.moments.results === true && Object.keys((await pool.query("SELECT disabled FROM notification_prefs WHERE user_id = $1", [A])).rows[0].disabled).length === 0, "on again: every one of its types on");
    // Mute a show (A6): a week, read back with its end; Undo puts it back as it was; unmute.
    const seasonNotify = (who, body) => as[who].call(body ? "PUT" : "GET", `/api/seasons/${sid}/notifications`, body);
    r = await seasonNotify("alex", { mute: "week" });
    const until = r.body.muted;
    const late = Date.parse(until) - Date.now() - 7 * 86400000;
    check(r.status === 200 && until && late > -60000 && late <= 3600000 && Date.parse(until) % 3600000 === 0, "muted for a week, its end said (on the hour after)", JSON.stringify(r.body.muted));
    check((await profile("alex")).notify.elsewhere.shows.some((x) => x.muted === until && x.seasonId), "Your settings lists it, with a season to open");
    check((await seasonNotify("alex", { mute: "month" })).status === 400, "a mute we don't offer: 400");
    r = await seasonNotify("alex", { mute: null });
    check(r.body.muted === null && !(await profile("alex")).notify.elsewhere.shows.length, "unmuted: gone from the list");
    r = await seasonNotify("alex", { muteUntil: until });
    check(r.body.muted === until, "Undo: the mute exactly as it was");
    await seasonNotify("alex", { mute: null });
    // A couch's own chat (A9): only someone on it; null goes back to the account's.
    const couchChat = (who, couchId, chat) => as[who].call(chat === undefined ? "GET" : "PUT", `/api/couches/${couchId}/chat-notify`, chat === undefined ? undefined : { chat });
    check((await couchChat("alex", fx.extraCouchId)).body.chat === null, "ZT Extra's chat: his default to start");
    check((await couchChat("alex", fx.extraCouchId, "off")).body.chat === "off" && (await profile("alex")).notify.elsewhere.couches.some((c) => c.couchId === fx.extraCouchId && c.chat === "off"), "Never, just on ZT Extra, and listed");
    check((await couchChat("riley", fx.extraCouchId, "off")).status === 404, "riley isn't on ZT Extra: 404");
    check((await couchChat("alex", fx.extraCouchId, "loud")).status === 400, "a choice we don't have: 400");
    await couchChat("alex", fx.extraCouchId, null);
    check(!(await profile("alex")).notify.elsewhere.couches.length, "his default again: off the list");
    // Your phones (A3): what gets notifications and where he's signed in; turn one off; sign out everywhere else.
    await pool.query(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, 'http://127.0.0.1:9/zt-phones-1', 'k', 'a', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1'), ($1, 'http://127.0.0.1:9/zt-phones-2', 'k', 'a', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36')`, [A]);
    let ph = (await as.alex.call("GET", `/api/me/phones?here=${encodeURIComponent("http://127.0.0.1:9/zt-phones-2")}`)).body;
    check(ph.notify.length === 2 && ph.notify.find((x) => x.here)?.name === "Android phone · Chrome" && ph.notify.some((x) => x.name === "iPhone · Safari"), "two phones, named from their browsers, this one marked", JSON.stringify(ph.notify));
    check(ph.signedIn.some((x) => x.here), "where he's signed in, here marked");
    check((await as.riley.call("DELETE", "/api/me/phones", { id: ph.notify[0].id })).status === 200 && (await pool.query("SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = $1", [A])).rows[0].n === 2, "riley can't turn alex's phone off");
    await as.alex.call("DELETE", "/api/me/phones", { id: ph.notify.find((x) => !x.here).id });
    ph = (await as.alex.call("GET", "/api/me/phones")).body;
    check(ph.notify.length === 1, "turned one off");
    const other = await api({ user: fixture.username("alex"), pass: PASSWORD });
    check((await other.call("GET", "/api/me/profile")).status === 200, "signed in a second time");
    r = await as.alex.call("POST", "/api/me/phones", { signOutOthers: true, here: "http://127.0.0.1:9/zt-phones-2" });
    check(r.status === 200 && r.body.signedOut >= 1 && (await other.call("GET", "/api/me/profile")).status === 401, "sign out everywhere else: the other sign-in is out", JSON.stringify(r.body));
    check((await as.alex.call("GET", "/api/me/profile")).status === 200, "and this one stays in");
    check((await pool.query("SELECT endpoint FROM push_subscriptions WHERE user_id = $1", [A])).rows.map((x) => x.endpoint).join() === "http://127.0.0.1:9/zt-phones-2", "this phone's notifications stay; every other phone's stop");
    await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1", [A]);

    // ---------- one name ----------
    r = await save("alex", { name: "zt" });
    check(r.status === 400 && /3 to 30/.test(r.body.error), "a name too short: 400 in plain words", JSON.stringify(r.body));
    r = await save("alex", { name: "zt_nd_riley" });
    check(r.status === 400 && /taken/.test(r.body.error), "riley's name is taken", JSON.stringify(r.body));
    r = await save("alex", { name: "zt nd alex!" });
    check(r.status === 400, "spaces and punctuation: 400", JSON.stringify(r.body));
    // A message of his, to be signed with the new name; and riley's seat in the pool already goes by the name alex will take.
    const posted = await as.alex.call("POST", `/api/seasons/${sid}/chat?couch=${fx.couchId}`, { text: "zt settings check: signing off as alex" });
    check(posted.status === 200, "alex says something on the couch chat", JSON.stringify(posted.body));
    const pool0 = (await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.pool])).rows[0].state;
    pool0.players.find((x) => x.name === "riley").name = "Zt_Nd_Alexa";
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [fx.leagues.pool, JSON.stringify(pool0)]);
    r = await save("alex", { name: "ZT_ND_ALEXA" });
    check(r.status === 200 && r.body.name === "zt_nd_alexa" && r.body.account.username === "zt_nd_alexa", "a new name, kept in lower case", JSON.stringify(r.body));
    const u = (await pool.query(`SELECT username, name FROM "user" WHERE id = $1`, [A])).rows[0];
    check(u.username === "zt_nd_alexa" && u.name === "zt_nd_alexa", "his username and account name both", JSON.stringify(u));
    check((await seatNames(fx.leagues.outlast))[0] === "zt_nd_alexa" && (await seatNames(fx.leagues.lineup))[0] === "zt_nd_alexa" && (await seatNames(fx.leagues.extra))[0] === "zt_nd_alexa", "his seat in Outlast, Weekly Lineup and ZT Extra takes it");
    check((await seatNames(fx.leagues.pool))[0] === "alex", "not in the Survival Pool, where riley's seat already goes by it", (await seatNames(fx.leagues.pool)).join());
    const signed = (await pool.query("SELECT author_name FROM chat_messages WHERE user_id = $1 AND type = 'message'", [A])).rows.map((x) => x.author_name);
    check(signed.length === 1 && signed[0] === "zt_nd_alexa", "his message is signed with it", signed.join());
    const rileyGames = (await as.riley.call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body;
    const outlastTable = rileyGames.games.find((g) => g.leagueId === fx.leagues.outlast)?.table ?? [];
    check(outlastTable.some((row) => row.name === "zt_nd_alexa") && !outlastTable.some((row) => row.name === "alex"), "riley's Outlast table says zt_nd_alexa", JSON.stringify(outlastTable.map((x) => x.name)));
    check(memberIn(await home("riley"), fx.couchId, A)?.name === "zt_nd_alexa", "and so does the couch's line-up of people");
    const relogin = await api({ user: "zt_nd_alexa", pass: PASSWORD });
    check((await relogin.call("GET", "/api/me/profile")).body.name === "zt_nd_alexa", "he signs in with it");
    const pool1 = (await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.pool])).rows[0].state;
    pool1.players.find((x) => x.name === "Zt_Nd_Alexa").name = "riley";
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [fx.leagues.pool, JSON.stringify(pool1)]);
    r = await save("alex", { name: "zt_nd_alex" });
    check(r.status === 200 && (await seatNames(fx.leagues.pool))[0] === "zt_nd_alex", "back to zt_nd_alex: the pool's seat follows now nobody else there has it", (await seatNames(fx.leagues.pool)).join());

    // ---------- one face: the picture ----------
    const putPic = (who, body, type) => as[who].raw("PUT", "/api/me/picture", { body, type });
    let res = await putPic("alex", DOT, "image/gif");
    check(res.status === 415, "a GIF isn't a picture we keep: 415");
    res = await putPic("alex", Buffer.alloc(110 * 1024, 1), "image/jpeg");
    check(res.status === 413, "over 100 KB: 413");
    res = await putPic("alex", DOT, "image/png");
    const v = (await res.json()).picture;
    check(res.status === 200 && Number.isInteger(v) && v > 0, "a picture: saved, its version answered", String(v));
    h = await home("alex");
    check(h.user.picture === v && (await profile("alex")).picture === v, "on his home read and profile");
    check(memberIn(await home("riley"), fx.couchId, A)?.picture === v && memberIn(await home("casey"), fx.extraCouchId, A)?.picture === v, "and on riley's and casey's");
    res = await as.riley.raw("GET", `/api/people/${A}/picture?v=${v}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    check(res.status === 200 && res.headers.get("content-type") === "image/png" && bytes.equals(DOT), "riley (on his couch) reads it: the same bytes");
    check(/private/.test(res.headers.get("cache-control") || "") && /immutable/.test(res.headers.get("cache-control") || ""), "kept by the browser for good, never a shared cache", res.headers.get("cache-control"));
    res = await putPic("riley", DOT, "image/png");
    check(res.status === 200, "riley has one too");
    res = await as.casey.raw("GET", `/api/people/${fx.users.riley}/picture?v=1`);
    check(res.status === 404, "casey isn't on a couch with riley: 404");
    check((await fetch(`${BASE}/api/people/${A}/picture?v=${v}`)).status === 401, "signed out: 401");

    // ---------- the couch: rename, hand it on, a new code ----------
    const couchName = async () => (await pool.query("SELECT name FROM couches WHERE id = $1", [fx.couchId])).rows[0].name;
    const roles = async () => Object.fromEntries((await pool.query("SELECT user_id, role FROM couch_members WHERE couch_id = $1", [fx.couchId])).rows.map((x) => [x.user_id, x.role]));
    const couchPost = (who, body) => as[who].call("POST", `/api/couches/${fx.couchId}`, body);
    r = await couchPost("riley", { action: "rename", name: "Riley's Couch" });
    check(r.status === 403, "riley doesn't run the couch: no rename");
    check((await couchPost("alex", { action: "rename", name: "   " })).status === 400 && (await couchPost("alex", { action: "rename", name: "x".repeat(41) })).status === 400, "an empty or too-long name: 400");
    r = await couchPost("alex", { action: "rename", name: "  ZT  Couch   Council " });
    check(r.status === 200 && r.body.name === "ZT Couch Council" && (await couchName()) === "ZT Couch Council", "alex renames it (spaces tidied)", JSON.stringify(r.body));
    check((await home("jordan")).couches.find((c) => c.id === fx.couchId)?.name === "ZT Couch Council", "everyone on it sees the new name");
    check((await couchPost("alex", { action: "fly" })).status === 400, "an unknown action: 400");
    check((await couchPost("riley", { action: "handOn", to: fx.users.jordan })).status === 403, "riley can't hand it on");
    check((await couchPost("alex", { action: "handOn", to: fx.users.casey })).status === 404, "not to casey, who isn't on it");
    check((await couchPost("alex", { action: "handOn", to: A })).status === 400, "not to himself");
    r = await couchPost("alex", { action: "handOn", to: fx.users.riley });
    let rl = await roles();
    check(r.status === 200 && rl[fx.users.riley] === "owner" && rl[A] === "member" && Object.values(rl).filter((x) => x === "owner").length === 1, "alex hands it to riley: one owner, alex still on it", JSON.stringify(rl));
    check((await couchPost("riley", { action: "rename", name: "ZT Riley Runs It" })).status === 200 && (await couchPost("alex", { action: "rename", name: "Mine" })).status === 403, "now riley renames it, and alex can't");
    r = await couchPost("riley", { action: "handOn", to: A });
    rl = await roles();
    check(r.status === 200 && rl[A] === "owner" && rl[fx.users.riley] === "member", "riley hands it back");
    await couchPost("alex", { action: "rename", name: "ZT Survivor 51" });

    const code1 = (await as.alex.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code;
    const rileyCode = (await as.riley.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code;
    r = await as.alex.call("POST", `/api/couches/${fx.couchId}/invite`);
    const code2 = r.body.code;
    check(r.status === 200 && /^[A-Z2-9]{6}$/.test(code2) && code2 !== code1, "a new code for alex", `${code1} -> ${code2}`);
    check((await as.alex.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code === code2, "his code is the new one from now on");
    check((await as.casey.call("GET", `/api/couches/invite/${code1}`)).status === 404, "the old code opens nothing");
    check((await as.casey.call("GET", `/api/couches/invite/${code2}`)).status === 200, "the new one opens the couch");
    check((await as.riley.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code === rileyCode && (await as.casey.call("GET", `/api/couches/invite/${rileyCode}`)).status === 200, "riley's code is unchanged and still works");
    check((await as.casey.call("POST", `/api/couches/${fx.couchId}/invite`)).status === 404, "casey isn't on it: no code to renew");

    // Clean slate for the browser: no pictures, no colours.
    await pool.query("DELETE FROM user_pictures WHERE user_id = ANY($1::text[])", [Object.values(fx.users)]);
    res = await as.alex.raw("DELETE", "/api/me/picture");
    check(res.status === 200 && (await as.riley.raw("GET", `/api/people/${A}/picture?v=${v}`)).status === 404, "removed: nobody reads it any more");
    await save("alex", { ai: "chatgpt" });

    if (!apiOnly) {
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(st);
        });
      };
      let n = 0;
      const browse = async (who) => {
        const b = await open({ user: fixture.username(who), pass: PASSWORD, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        // Notifications allowed but not turned on (a headless browser blocks them otherwise): this phone is Off, and nothing reaches him.
        await b.page.context().grantPermissions(["clipboard-read", "clipboard-write", "notifications"], { origin: BASE });
        await b.page.emulateMedia({ reducedMotion: "reduce" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
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
        const sheet = pg.locator("[role=dialog][data-open]");
        // The refusals the check asks for (a name that's taken, a wrong password) are 400s the browser logs; nothing else may be.
        const errors = () => b.errors.filter((e) => !(favicon && /Failed to load resource/.test(e)) && !/responded with a status of 400/.test(e));
        return { b, pg, shot, wide, toasted, sheet, errors };
      };

      // ---------- alex: Your settings (settings Round 1) ----------
      const a = await browse("alex");
      const { pg } = a;
      // A pushed page (?page=) is a role=dialog over Your settings; its Back is the first button in its bar.
      const page = (title) => pg.locator("[role=dialog][aria-hidden=false]").filter({ has: pg.locator("h3", { hasText: new RegExp(`^${title}$`) }) });
      const openGroup = async (id, ready) => {
        await pg.locator(`[data-settings-groups] [data-group="${id}"], [data-settings-help] [data-group="${id}"], [data-settings-account] [data-group="${id}"]`).first().click();
        await pg.locator(ready).waitFor({ timeout: 15000 });
        await pg.waitForTimeout(600);
      };
      const backFrom = async (title) => {
        await page(title).locator("button").first().click();
        await pg.waitForFunction(() => !new URL(location.href).searchParams.get("page"), null, { timeout: 10000 }).catch(() => {});
      };
      await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
      await pg.locator("[data-me-card]").waitFor({ timeout: 30000 });
      await pg.locator("[data-settings-groups] [data-group]").first().waitFor({ timeout: 30000 });
      await pg.waitForFunction(() => !/…/.test(document.querySelector("[data-settings-groups]")?.textContent || "…"), null, { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const meLine = await pg.locator("[data-me-card]").textContent();
      check(/zt_nd_alex/.test(meLine) && /On ZT Extra and ZT Survivor 51|On ZT Survivor 51 and ZT Extra/.test(meLine), "you: his name and his two couches", meLine);
      check(/Your settings/.test(await pg.locator("header h1").first().textContent()), "the page is Your settings");
      // Round 0's shape: five groups, each its name over its value, then Account and help.
      const groups = await pg.locator("[data-settings-groups] [data-group], [data-settings-groups] [data-fold]").evaluateAll((els) => els.map((e) => e.getAttribute("data-group") || e.getAttribute("data-fold")));
      check(groups.join("|") === "notifications|results|privacy|appearance|yours", "five groups: Notifications, When results show, Privacy, Appearance, Your shows couches and games", groups.join("|"));
      const value = async (id) => (await pg.locator(`[data-group="${id}"] [data-group-value]`).innerText()).trim();
      // Nothing reaches him (this phone off, no other phone of his): the plate says so, so the row says what's chosen instead.
      check((await pg.locator("[data-phone-plate][data-phone=off]").count()) === 1, "nothing reaches him: the plate, Notifications are off");
      check(/^Chosen: reminders, results, your couch$/.test(await value("notifications")), "Notifications: what's chosen (the plate says it's off)", await value("notifications"));
      check((await value("results")) === "After you've watched", "When results show: After you've watched (no sports followed, so no sports half)", await value("results"));
      check((await value("privacy")) === "Your couches see how far you've watched", "Privacy: the one switch's outcome", await value("privacy"));
      check(/^(Same as my phone · (dark|light) now|Dark|Light)$/.test(await pg.locator('[data-fold="appearance"] [data-fold-value]').innerText()), "Appearance: its value, shut", await pg.locator('[data-fold="appearance"] [data-fold-value]').innerText());
      check(/^\d+ shows? · 2 couches · \d+ games$/.test(await value("yours")), "Your shows, couches and games: how many of each", await value("yours"));
      const help = await pg.locator("[data-settings-help]").innerText();
      check(
        /Your account/.test(help) && /Report a problem/.test(help) && /Take the tour/.test(help) && /Where art and data come from/.test(help) && /Sign out/.test(help) && !/Site admin/.test(help),
        "Account and help: Your account, Report a problem, Take the tour, Where art and data come from, Sign out (no Site admin: he isn't one)",
        help
      );
      check(/zt_nd_alex · password, your phones/.test(await value("account")), "Your account: how he signs in", await value("account"));
      const gone = await pg.locator("[data-settings]").innerText();
      check(!/Grok|Your AI|How each game works|Quick settings|Everything else/.test(gone), "gone: Your AI (C8), How each game works (C9), Quick settings and the folds", gone.match(/Grok|Your AI|How each game works|Quick settings|Everything else/g)?.join());
      check(!/Turns off notifications on this phone/.test(help), "Sign out says nothing about this phone while it's off");
      const small = await pg.locator("[data-settings] button:visible, [data-settings] a:visible").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44).length);
      check(small === 0, "every button and link on Your settings is at least 44px tall", String(small));
      await a.wide("Your settings");
      await a.shot("settings-top");
      await pg.locator("[data-sign-out]").scrollIntoViewIfNeeded();
      await a.shot("settings-end");

      // Appearance opens in place; nothing else does.
      await pg.locator('[data-fold="appearance"] > button').click();
      await pg.locator('[data-choice^="theme-"]').first().waitFor();
      check((await pg.locator('[data-choice^="theme-"]').count()) === 3 && new URL(pg.url()).searchParams.get("page") === null, "Appearance: its three choices, in place");
      await pg.locator('[data-fold="appearance"] > button').click();

      // When results show: Straight away asks first (Undo can't unsee a result); Keep them hidden leaves it; Show them saves, with Undo.
      await openGroup("results", "[data-settings-results]");
      check(new URL(pg.url()).searchParams.get("page") === "results", "a group is a page with its own address (?page=results)");
      check((await pg.locator('[data-choice="hide-on"]').getAttribute("aria-checked")) === "true", "After you've watched is his (Recommended)");
      check((await pg.locator("[data-settings-sports]").count()) === 0, "no Sports half: he follows no sport");
      await a.wide("When results show");
      await a.shot("results");
      await pg.locator('[data-choice="hide-off"]').click();
      await pg.locator("[data-hide-warn]").waitFor({ timeout: 5000 });
      check(/Show results straight away\?/.test(await pg.locator("[data-hide-warn]").innerText()) && (await immediate()) === false, "Straight away asks first, and nothing's saved yet");
      await a.shot("results-ask");
      await pg.locator("[data-hide-keep]").click();
      check((await pg.locator("[data-hide-warn]").count()) === 0 && (await pg.locator('[data-choice="hide-on"]').getAttribute("aria-checked")) === "true", "Keep them hidden: still After you've watched");
      await pg.locator('[data-choice="hide-off"]').click();
      await pg.locator("[data-hide-confirm]").click();
      check(await a.toasted(/Results show straight away/), "Show them: the toast says what it means");
      check((await immediate()) === true, "saved: he sees results straight away");
      await pg.locator('[data-reset="hide"]').waitFor({ timeout: 10000 }).catch(() => {});
      check((await pg.locator('[data-reset="hide"]').count()) === 1, "Reset to recommended, once it's changed");
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction(() => document.querySelector('[data-choice="hide-on"]')?.getAttribute("aria-checked") === "true", null, { timeout: 15000 });
      check((await immediate()) === false, "Undo: results wait again");
      await backFrom("When results show");
      check(new URL(pg.url()).searchParams.get("page") === null && (await pg.locator("[data-settings-results]").count()) === 0, "Back: Your settings again");

      // Privacy, opened by its address; the phone's back gesture closes it.
      await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
      await pg.locator("[data-settings-groups]").waitFor({ timeout: 30000 });
      await openGroup("privacy", "[data-settings-sharing]");
      await pg.goBack();
      await pg.locator("[data-settings-sharing]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
      check((await pg.locator("[data-settings-sharing]").count()) === 0 && /\/settings$/.test(new URL(pg.url()).pathname), "the phone's Back closes a page, back on Your settings", pg.url());

      // The profile sheet.
      await pg.locator("[data-edit-profile]").click();
      await pg.locator("[data-profile-sheet]").waitFor();
      await pg.waitForTimeout(500);
      await a.shot("profile");
      // A colour that isn't already his (with none chosen, his id picks one, which can be any of them), then another for the picture.
      const swatches = await pg.locator("[data-colour]").evaluateAll((els) => els.filter((e) => e.getAttribute("aria-checked") === "false").map((e) => e.getAttribute("data-colour")));
      const [hex, hex2] = swatches;
      const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
      await pg.locator(`[data-colour="${hex}"]`).click();
      // The saved row first (under a batch's load the PUT can answer slowly), then the toast it answers with.
      let kept = false;
      for (const t = Date.now(); !kept && Date.now() - t < 30000; await new Promise((r) => setTimeout(r, 250))) {
        kept = (await pool.query("SELECT colour FROM user_settings WHERE user_id = $1", [A])).rows[0]?.colour === hex;
      }
      check(kept, `a colour (${hex}): kept on his account`);
      check(await a.toasted(/Saved: your colour/), "the colour: saved");
      await pg.waitForFunction((c) => getComputedStyle(document.querySelector("[data-me-card] [data-face]")).backgroundColor === c, rgb, { timeout: 15000 }).catch(() => {});
      check((await pg.locator("[data-me-card] [data-face]").evaluate((e) => getComputedStyle(e).backgroundColor)) === rgb, "his face on the me card takes it at once");
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction((h) => document.querySelector(`[data-colour="${h}"]`)?.getAttribute("aria-checked") === "false", hex, { timeout: 15000 }).catch(() => {});
      check((await pool.query("SELECT colour FROM user_settings WHERE user_id = $1", [A])).rows[0].colour === null, "Undo: back to his id's colour");
      await pg.locator(`[data-colour="${hex2}"]`).click();
      await a.toasted(/Saved: your colour/);
      await pg.locator("[data-picture-input]").setInputFiles(ART);
      check(await a.toasted(/Saved: your picture/), "a picture: chosen and saved");
      const pic = await pool.query("SELECT octet_length(picture) AS n, type FROM user_pictures WHERE user_id = $1", [A]);
      check(pic.rows[0]?.type === "image/jpeg" && pic.rows[0].n < 60 * 1024 && fs.statSync(ART).size > pic.rows[0].n, "shrunk in the browser to a small JPEG", JSON.stringify(pic.rows[0]));
      await pg.locator("[data-profile-face=picture] img").waitFor({ timeout: 15000 });
      await pg.waitForFunction(() => [...document.querySelectorAll("[data-face=picture] img")].some((i) => i.complete && i.naturalWidth === 256), null, { timeout: 15000 }).catch(() => {});
      check((await pg.locator("[data-me-card] [data-face=picture] img").evaluate((i) => i.naturalWidth)) === 256, "the me card shows it (256 by 256)");
      await a.shot("profile-picture");
      await pg.locator("#profile-name").fill("zt_nd_riley");
      await pg.locator("[data-profile-save]").click();
      await pg.locator("[data-profile-error]").waitFor();
      check(/taken/.test(await pg.locator("[data-profile-error]").innerText()), "riley's name: taken, said under the field");
      await pg.locator("#profile-name").fill("zt_nd_alexz");
      await pg.locator("[data-profile-save]").click();
      check(await a.toasted(/your couch sees you as zt_nd_alexz/), "a new name: saved");
      await pg.waitForFunction(() => document.querySelector("[data-me-name]")?.textContent === "zt_nd_alexz", null, { timeout: 15000 }).catch(() => {});
      check((await pg.locator("[data-me-name]").textContent()) === "zt_nd_alexz", "the me card says it at once");
      check((await seatNames(fx.leagues.outlast))[0] === "zt_nd_alexz", "his seats too");
      await a.wide("the profile sheet");
      await a.shot("profile-named");
      await pg.keyboard.press("Escape");
      await a.sheet.waitFor({ state: "hidden" }).catch(() => {});

      // The hub: his face is his picture; the gear opens Your settings; the picture's sheet keeps a quiet row, and no tour (C13).
      await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      await pg.locator("header [data-face]").first().waitFor({ timeout: 30000 });
      await pg.waitForFunction(() => document.querySelector("header [data-face]")?.getAttribute("data-face") === "picture", null, { timeout: 15000 }).catch(() => {});
      check((await pg.locator("header [data-face]").first().getAttribute("data-face")) === "picture", "the hub's top: his picture");
      await pg.waitForTimeout(800);
      await a.shot("hub");
      await pg.locator('[data-tour="you"]').click();
      await a.sheet.waitFor({ timeout: 10000 });
      await pg.waitForTimeout(500);
      const youSheet = await a.sheet.innerText();
      check(/Your settings/.test(youSheet) && !/Take the tour/.test(youSheet), "his picture's sheet: a Your settings row, no Take the tour", youSheet);
      await pg.keyboard.press("Escape");
      await a.sheet.waitFor({ state: "hidden" }).catch(() => {});
      await pg.locator("[data-gear]").click();
      await pg.waitForURL((u) => u.pathname === "/settings", { timeout: 20000 }).catch(() => {});
      check(new URL(pg.url()).pathname === "/settings", "the hub's gear opens Your settings", pg.url());

      // Ask an AI: one link, Open in ChatGPT, and Copy the question for any other AI (C8: no Grok, no setting). Episode 6 has aired
      // (the season moved back five days).
      await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
      await pg.goto(`${BASE}/show/${sid}/backstage`, { waitUntil: "load" });
      await pg.locator("[data-job=quick]").waitFor({ timeout: 30000 });
      await pg.locator("[data-job=quick]").click();
      await pg.locator("[data-ask=quick]").waitFor();
      await pg.locator("[data-ask=quick]").click();
      await pg.locator("[data-ask-ai=quick], [data-one-tap]").first().waitFor({ timeout: 20000 });
      if (await pg.locator("[data-one-tap]").count()) await pg.locator("[data-copy-paste]").click();
      await pg.locator("[data-ask-ai=quick]").waitFor();
      await pg.locator("a[data-ai-open][href]").first().waitFor({ timeout: 20000 });
      const links = await pg.locator("[data-ask-ai] a[data-ai-open]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-ai-open")}:${e.getAttribute("href")}`));
      check(links.length === 1 && /^chatgpt:https:\/\/chatgpt\.com/.test(links[0]), "Ask an AI: one link, Open in ChatGPT", links.join(" | "));
      check(/Copy the question/.test(await pg.locator("[data-ask-ai] [data-ai-copy]").innerText()) && !/Grok/.test(await pg.locator("[data-ask-ai]").innerText()), "and Copy the question for any other AI; no Grok");
      await a.wide("Ask an AI");
      await a.shot("ask-ai");
      await pool.query("UPDATE show_seasons SET premiere_date = premiere_date + 5 WHERE id = $1", [sid]);

      // Your shows, couches and games: the map; a couch opens its page (rename with Undo, a new code, Hand it on).
      await pg.goto(`${BASE}/settings?page=yours`, { waitUntil: "load" });
      await pg.locator("[data-settings-yours]").waitFor({ timeout: 30000 });
      await pg.locator('[data-yours-couch="ZT Survivor 51"]').waitFor({ timeout: 30000 });
      await pg.waitForTimeout(600);
      const yourCouch = await pg.locator('[data-yours-couch="ZT Survivor 51"]').innerText();
      check(/you run it/.test(yourCouch) && /chat: your default/.test(yourCouch), "the map: ZT Survivor 51, you run it, chat: your default", yourCouch);
      check(/2 people/.test(await pg.locator('[data-yours-couch="ZT Extra"]').innerText()), "ZT Extra: him and casey");
      check((await pg.locator(`[data-yours-show="${sid}"] [data-yours-game]`).count()) === 3, "ZT Survivor 51 lists his three games");
      check(/You run it/.test(await pg.locator(`[data-yours-show="${sid}"] [data-yours-game]`).first().innerText()), "each says his part in it (You run it)");
      await a.wide("Your shows, couches and games");
      await a.shot("yours");
      await pg.locator('[data-yours-couch="ZT Survivor 51"]').click();
      await pg.locator("[data-couch-details]").waitFor();
      await pg.waitForTimeout(600);
      check(/Runs it/.test(await pg.locator(`[data-member="zt_nd_alexz"]`).innerText()), "the couch's page: Runs it under alex");
      check((await a.sheet.locator('[data-couch-chat="default"]').count()) === 1, "and its own chat row, on his default");
      await a.shot("couch");
      const before = await pg.locator("[data-invite-code]").getAttribute("data-invite-code");
      await pg.locator("[data-new-code]").click();
      await pg.locator("[data-new-code=ask]").waitFor();
      check(new RegExp(before).test(await pg.locator("[data-new-code=ask]").innerText()), "a new code asks first, naming the code that stops working");
      await a.shot("couch-new-code");
      await pg.locator("[data-new-code-make]").click();
      check(await a.toasted(/New code/), "made");
      await pg.waitForFunction((b) => { const c = document.querySelector("[data-invite-code]")?.getAttribute("data-invite-code"); return c && c !== b; }, before, { timeout: 15000 });
      const after = await pg.locator("[data-invite-code]").getAttribute("data-invite-code");
      check((await as.casey.call("GET", `/api/couches/invite/${before}`)).status === 404 && (await as.casey.call("GET", `/api/couches/invite/${after}`)).status === 200, "the sheet shows the new one; the old one opens nothing");
      await a.sheet.getByRole("button", { name: /Rename the couch/ }).click();
      await pg.locator("[data-couch-rename]").waitFor();
      await pg.locator("[data-couch-rename]").fill("ZT Couch Council");
      await a.shot("couch-rename");
      await a.sheet.getByRole("button", { name: /Save the name/ }).click();
      check(await a.toasted(/Renamed: ZT Couch Council/), "renamed");
      check((await couchName()) === "ZT Couch Council", "saved for everyone");
      await pg.locator("[role=status] button", { hasText: /undo/i }).click();
      await pg.waitForFunction(() => !!document.querySelector('[data-yours-couch="ZT Survivor 51"]'), null, { timeout: 15000 }).catch(() => {});
      check((await couchName()) === "ZT Survivor 51", "Undo: its old name back");
      if (!(await pg.locator("[data-couch-details]").count())) {
        await pg.locator('[data-yours-couch="ZT Survivor 51"]').click();
        await pg.locator("[data-couch-details]").waitFor();
      }
      await a.sheet.getByRole("button", { name: /Hand it on/ }).click();
      await pg.locator("[data-hand-on]").waitFor();
      await pg.locator('[data-hand-to="zt_nd_riley"]').click();
      await a.wide("Hand it on");
      await a.shot("hand-on");
      await pg.keyboard.press("Escape");
      check((await roles())[A] === "owner", "closing without handing it on leaves it his");
      await a.sheet.waitFor({ state: "hidden" }).catch(() => {});

      // Your account: how he signs in, Change password (a wrong one refused, then changed and changed back), Your phones.
      await pg.goto(`${BASE}/settings?page=account`, { waitUntil: "load" });
      await pg.locator("[data-settings-account]").waitFor({ timeout: 30000 });
      await pg.waitForTimeout(600);
      const acct = await pg.locator("[data-settings-account]").innerText();
      check(/zt_nd_alexz/.test(acct) && /Change password/.test(acct) && /Your phones/.test(acct) && /Install the app/.test(acct) && /Back to the classic design/.test(acct), "Your account: his name, Change password, Your phones, Install the app, the classic design", acct);
      check(!/Google/.test(acct) || !!process.env.GOOGLE_CLIENT_ID, "no Google row while it isn't set up");
      await a.wide("Your account");
      await a.shot("account");
      await pg.locator("[data-settings-account] [data-group=phones]").click();
      await pg.locator("[data-settings-phones]").waitFor({ timeout: 15000 });
      await pg.waitForTimeout(600);
      check((await page("Your phones").locator("button").first().innerText()).includes("Your account"), "Your phones: its Back says Your account");
      check(/signed in/i.test(await pg.locator("[data-settings-phones]").innerText()), "Your phones: where he's signed in", await pg.locator("[data-settings-phones]").innerText());
      await a.shot("phones");
      await backFrom("Your phones");
      await pg.goto(`${BASE}/settings?page=account`, { waitUntil: "load" });
      await pg.locator("[data-settings-account]").waitFor({ timeout: 30000 });
      await pg.locator("[data-settings-account]").getByRole("button", { name: /Change password/ }).click();
      await pg.locator("[data-password-sheet]").waitFor();
      await pg.locator("#pw-current").fill("not-my-password");
      await pg.locator("#pw-next").fill("zt-pass-67890");
      await pg.locator("#pw-again").fill("zt-pass-67890");
      await a.sheet.getByRole("button", { name: /^Change password$/ }).click();
      await a.sheet.getByRole("alert").waitFor();
      check(/isn't your password/.test(await a.sheet.getByRole("alert").innerText()), "a wrong password now: refused in plain words");
      await a.shot("password");
      await pg.locator("#pw-current").fill(PASSWORD);
      await a.sheet.getByRole("button", { name: /^Change password$/ }).click();
      check(await a.toasted(/Password changed/), "changed");
      const changed = await fetch(BASE + "/api/auth/sign-in/username", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: "zt_nd_alexz", password: "zt-pass-67890" }) });
      check(changed.ok, "the new one signs him in");
      await a.sheet.waitFor({ state: "hidden" }).catch(() => {});
      await pg.locator("[data-settings-account]").getByRole("button", { name: /Change password/ }).click();
      await pg.locator("#pw-current").fill("zt-pass-67890");
      await pg.locator("#pw-next").fill(PASSWORD);
      await pg.locator("#pw-again").fill(PASSWORD);
      await a.sheet.getByRole("button", { name: /^Change password$/ }).click();
      await a.sheet.waitFor({ state: "hidden" }).catch(() => {});
      const back = await fetch(BASE + "/api/auth/sign-in/username", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: "zt_nd_alexz", password: PASSWORD }) });
      check(back.ok, "and back: the old one signs him in again");

      // Report a problem, from Account and help.
      await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
      await pg.locator("[data-settings-help]").waitFor({ timeout: 30000 });
      await pg.getByRole("button", { name: /Report a problem/ }).click();
      await pg.locator("[data-report-sheet]").waitFor();
      await pg.locator("[data-report-type=feature]").click();
      await pg.locator("[data-report-text]").fill("zt settings check: an idea from the check");
      await a.shot("report");
      await pg.locator("[data-report-send]").click();
      check(await a.toasted(/Sent/), "Report a problem: sent");
      const rep = (await pool.query("SELECT type, route, username FROM issue_reports WHERE user_id = $1 AND message LIKE 'zt settings check%'", [A])).rows[0];
      check(rep?.type === "feature" && rep.route === "/settings" && rep.username === "zt_nd_alexz", "kept for us: an idea, from /settings, by him", JSON.stringify(rep));
      check(a.errors().length === 0, "alex: no page errors", a.errors().join(" | "));

      // ---------- riley: alex's face on the couch ----------
      const rr = await browse("riley");
      await rr.pg.goto(`${BASE}/settings?page=yours`, { waitUntil: "load" });
      await rr.pg.locator('[data-yours-couch="ZT Survivor 51"]').waitFor({ timeout: 30000 });
      check(!/you run it/.test(await rr.pg.locator('[data-yours-couch="ZT Survivor 51"]').innerText()), "riley's map: the couch, not his to run");
      await rr.pg.locator('[data-yours-couch="ZT Survivor 51"]').click();
      await rr.pg.locator("[data-couch-details]").waitFor();
      const face = rr.pg.locator('[data-member="zt_nd_alexz"] [data-face]');
      await rr.pg.waitForFunction(() => document.querySelector('[data-member="zt_nd_alexz"] [data-face]')?.getAttribute("data-face") === "picture", null, { timeout: 15000 }).catch(() => {});
      check((await face.getAttribute("data-face")) === "picture", "riley sees alex's picture on his face");
      await rr.pg.waitForFunction(() => { const i = document.querySelector('[data-member="zt_nd_alexz"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
      check((await rr.pg.locator('[data-member="zt_nd_alexz"] img').evaluate((i) => i.naturalWidth)) === 256, "and it loads for him");
      check((await rr.sheet.getByRole("button", { name: /Rename the couch|Hand it on/ }).count()) === 0, "riley doesn't run it: no Rename or Hand it on");
      check((await rr.pg.locator("[data-new-code]").count()) === 1, "but he can get a new code of his own");
      await rr.wide("the couch's sheet");
      await rr.shot("couch");
      check(rr.errors().length === 0, "riley: no page errors", rr.errors().join(" | "));
    }
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
