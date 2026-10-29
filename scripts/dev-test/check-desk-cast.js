// Dev-only check for a season's Cast on the desk (docs/PLAN-desk-parity.md step 5, part 5a), against this lane's dev server, on
// a fixture of its own (zt_dc_ people: zt_dc_desk a site admin, zt_dc_jo who plays). The ZT DC Show has three seasons:
//   Season 1, airing: 8 castaways in Toka and Savu, sent to one game (jo's, ZT DC Game, every castaway linked to the season's
//            cast; jo has Brady on a team); Aaliyah out in Episode 1 (an accepted result).
//   Season 2, upcoming: no cast.
//   Season 3, upcoming: 3 castaways staged and never sent (classic's pull), no games.
// The ask-AI bot is the stand-in (fake-bot.js, through the dev-only x-gys-bot header), never a real one.
//   1. Only site admins: zt_dc_jo is refused the page, its question and every change.
//   2. The read: Season 1 in the games (its lower third, where it came from, its tribes with their colours, the castaways with
//      who's out); the season page's Cast row; Season 2 no cast; Season 3 not sent (a first send), and the Inbox's item.
//   3. Paste it on Season 1: its question; a paste staged, not written (a new spelling, a tribe it has differently, someone new,
//      someone it no longer lists), its History line; the row's dot and the Inbox's item; an answer that changes nothing.
//   4. Send to its games: the preview (Same person and Keep ours as they default; Use theirs); a stale answer refused; sent (the
//      rename by id reaches the game, the team keeps them; someone new joins as nobody's; the tribe), off the Inbox; Undo puts it
//      back; Undo refused once someone who joined is on a team.
//   5. Ask our bot on Season 2: queued, asked, its answer staged (everyone new); Send and Undo; the bot down; an answer it can't
//      read (History says so). Season 3's first send, and its Undo.
//   6. In the browser at --width: the season page's row to the page; Season 1's page; Paste it (Ask an AI, then What changed,
//      Use Savu, Send's preview, sent, Undo); the Inbox's item to the page; Season 2's Ask our bot (asking, then its answer's
//      review). Nothing wider than the screen; the season's Delete last; no page errors.
//   7. Nothing real moved: no real season's cast or answers.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-cast.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-cast.js --down           (takes the fixture down, nothing else)
//
// up/down: zt_dc_ accounts, the ZT DC Show and its seasons (cast, answers, runs and results cascade), its game and couch, and
// the admin_changes lines on them; --keep leaves it up. Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fakeBot = require("./fake-bot");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-cast runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-cast.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dc_${k}`;
const SHOW = "zt-dc-show";
const NAME = "ZT DC Show";
const FACES = ["aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way"];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const CAST = FACES.map(nameOf);
const TRIBES = [["toka", "Toka", "#e0b23a"], ["savu", "Savu", "#9b6bd0"]];
const tribeOf = (i) => TRIBES[i % 2][1];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fixture ----------

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_dc\\_%'`);
  const ids = users.map((u) => u.id);
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id IN (
       SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2
       UNION SELECT sc.id::text FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2)`,
    [ids, SHOW]
  );
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-dc-%'");
  await pool.query("DELETE FROM couches WHERE name = 'ZT DC Couch'");
  await pool.query("DELETE FROM ai_briefs WHERE created_by = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dc\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-dc-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-dc.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  await add("jo");
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  ids.show = (await one("INSERT INTO shows (slug, name, kind, created_by, set_up_at, castaway_term, tribe_term) VALUES ($1, $2, 'competition', $3, now(), 'Castaway', 'Tribe') RETURNING id", [SHOW, NAME, ids.desk])).id;
  ids.s1 = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_count, cast_approved_at, cast_approved_by)
     VALUES ($1, 1, 'airing', current_date - 15, '20:00', 'America/New_York', 'weekly', 10, now() - interval '20 days', $2) RETURNING id`,
    [ids.show, ids.desk]
  )).id;
  ids.s2 = (await one("INSERT INTO show_seasons (show_id, season_number, status, episode_count) VALUES ($1, 2, 'upcoming', 10) RETURNING id", [ids.show])).id;
  ids.s3 = (await one("INSERT INTO show_seasons (show_id, season_number, status, episode_count) VALUES ($1, 3, 'upcoming', 10) RETURNING id", [ids.show])).id;
  ids.cast = {};
  for (const [i, slug] of FACES.entries())
    ids.cast[CAST[i]] = (await one("INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id", [ids.s1, CAST[i], tribeOf(i), `/mock/showcase/img/survivor-51/${slug}.jpg`, i])).id;
  for (const [i, n] of ["Ada Example", "Bo Example", "Cy Example"].entries()) await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, $2, $3)", [ids.s3, n, i]);
  // Aaliyah went home in Episode 1.
  await pool.query(
    `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, decided_at)
     VALUES ($1, 1, 'elimination', 'Aaliyah Puglia', 'Voted Out', '', 'accepted', 'confirmed', true, now() - interval '14 days')`,
    [ids.s1]
  );
  // jo's game on Season 1: everyone linked to the season's cast; Brady on jo's team.
  ids.couch = (await one("INSERT INTO couches (name, created_by) VALUES ('ZT DC Couch', $1) RETURNING id", [ids.jo])).id;
  const state = JSON.parse(JSON.stringify(buildDemoState({
    id: "zt-dc", showId: SHOW, showName: NAME, seasonName: `${NAME} 1`, episodeCount: 10,
    players: [{ key: "jo", name: "jo", color: "#888" }, { key: "sam", name: "sam", color: "#888" }],
    groups: TRIBES.map(([key, name, color]) => ({ key, name, color })),
    castaways: FACES.map((slug, i) => ({ key: `k${i}`, name: CAST[i], placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`, groupKey: TRIBES[i % 2][0], ...(i === 0 ? { exitEpisode: 1, exitMethod: "Voted Out" } : {}) })),
  }, "pickem", 1)));
  S.migrateLeagueState(state);
  state.settings.showId = SHOW;
  state.settings.wikiSeason = 1;
  for (const c of state.castaways) c.seasonCastId = ids.cast[c.name];
  state.castaways.find((c) => c.name === "Brady Booker").ownerIds = [state.players[0].id];
  ids.player = state.players[0].id;
  ids.league = (await one("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('ZT DC Game', 'zt-dc-game', 'ZTDCGM', $1, $2, $3) RETURNING id", [JSON.stringify(state), ids.jo, ids.couch])).id;
  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'commissioner')", [ids.league, ids.jo, ids.player]);
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'owner')", [ids.couch, ids.jo]);
  return ids;
}

const REAL = `SELECT md5(coalesce(string_agg(sc.id || sc.name || coalesce(sc.tribe_name, ''), ',' ORDER BY sc.id), '')) AS cast,
    (SELECT count(*)::int FROM season_cast_answers a JOIN show_seasons ss ON ss.id = a.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%') AS answers
  FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

/** A chat's cast answer (cast-prompt.js's shape). */
const castAnswer = (rows) => "```json\n" + JSON.stringify({ castaways: rows.map(([name, startingGroup = "", photoUrl = ""]) => ({ name, photoUrl, startingGroup })), sources: ["https://example.com/zt-dc"] }) + "\n```";
// Season 1's paste: Cristian spelled Kristian, Brady (Savu) on Toka, Zed new, Devin not listed.
const PASTE = castAnswer([...CAST.filter((n) => n !== "Devin Way").map((n) => [n === "Cristian Chavez" ? "Kristian Chavez" : n, n === "Brady Booker" ? "Toka" : tribeOf(CAST.indexOf(n))]), ["Zed Newman", "Toka"]]);
// The cast as the second send left it (Kristian, Zed joined; Brady kept on Savu): a paste of it changes nothing.
const SAME = castAnswer([...CAST.map((n, i) => [n === "Cristian Chavez" ? "Kristian Chavez" : n, tribeOf(i)]), ["Zed Newman", "Toka"]]);
const S2 = castAnswer([["Eve One", "Red"], ["Fay Two", "Red"], ["Gus Three", "Blue"], ["Hal Four", "Blue"], ["Ivy Five", "Blue"]]);

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dc_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL)).rows[0];
  const closers = [];
  try {
    const ids = await up(pool);
    let botAnswer = S2;
    const bot = await fakeBot.start({
      delayMs: 1500,
      answer: (prompt, kind) => {
        if (kind !== "cast") throw new Error(`only the cast is asked here, not ${kind}`);
        return botAnswer;
      },
    });
    closers.push(bot.close);
    const headers = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD, headers }), jo: await api({ user: U("jo"), pass: PASSWORD, headers }) };
    const P = (s) => `/api/desk/seasons/${s}/cast`;
    const read = async (s) => (await as.desk.call("GET", P(s))).body;
    const post = (s, body) => as.desk.call("POST", P(s), body);
    const undoIt = (changeId) => as.desk.call("POST", `/api/desk/changes/${changeId}/undo`, {});
    const leagueState = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [ids.league])).rows[0].state;
    const castNames = async (s) => (await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [s])).rows.map((r) => r.name);
    const inbox = async () => (await as.desk.call("GET", "/api/desk/inbox")).body.items.filter((i) => i.kind === "cast" && /ZT DC/.test(i.title));
    const drained = async (ms = 60000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const { rows } = await pool.query("SELECT 1 FROM desk_runs d JOIN show_seasons ss ON ss.id = d.season_id WHERE ss.show_id = $1 AND d.done_at IS NULL", [ids.show]);
        if (!rows.length) return true;
        await sleep(500);
      }
      return false;
    };

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", P(ids.s1)),
      as.jo.call("GET", `${P(ids.s1)}/question`),
      as.jo.call("POST", P(ids.s1), { ask: true }),
      as.jo.call("POST", P(ids.s1), { paste: PASTE }),
      as.jo.call("POST", P(ids.s1), { send: true, answer: null, preview: true }),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the page, its question and every change", refused.map((r) => r.status).join(","));
    check((await as.desk.call("GET", P("not-a-season"))).status === 404 && (await as.desk.call("GET", P(crypto.randomUUID()))).status === 404, "a season that isn't: 404");

    // ---- 2. the read ----
    let c1 = await read(ids.s1);
    check(c1.state === "sent" && c1.tag === "In the games" && c1.detail === "8 castaways · 2 tribes" && c1.games === 1 && c1.review === null, "Season 1: in the games, 8 castaways in 2 tribes", JSON.stringify({ s: c1.state, t: c1.tag, d: c1.detail, g: c1.games }));
    check(/^Sent \w{3} \d{1,2} to 1 game$/.test(c1.meta || ""), "where it came from: sent, to its game", c1.meta);
    check(JSON.stringify(c1.groups.map((g) => [g.name, g.people, g.color])) === JSON.stringify([["Toka", 4, "#e0b23a"], ["Savu", 4, "#9b6bd0"]]), "its tribes, how many start in each, their colours from its game", JSON.stringify(c1.groups));
    check(c1.cast.length === 8 && c1.cast.find((c) => c.name === "Aaliyah Puglia").out === 1 && c1.cast.filter((c) => c.out).length === 1, "the castaways, Aaliyah out in Episode 1");
    check(c1.terms.people === "castaways" && c1.terms.groups === "tribes" && c1.delete && c1.history.length === 0, "the show's own words; its Delete; no History yet");
    let sp = (await as.desk.call("GET", `/api/desk/seasons/${ids.s1}`)).body;
    check(sp.castRow?.line === "8 castaways · in its game" && sp.castRow.need === false, "the season page's Cast row", JSON.stringify(sp.castRow));
    const c2 = await read(ids.s2);
    check(c2.state === "none" && c2.tag === "No cast" && c2.detail === "Nothing to draft or pick from" && c2.meta === null, "Season 2: no cast", JSON.stringify({ s: c2.state, t: c2.tag, m: c2.meta }));
    check((await as.desk.call("GET", `/api/desk/seasons/${ids.s2}`)).body.castRow?.line === "No cast yet: nothing to draft or pick from", "its row: no cast yet");
    const c3 = await read(ids.s3);
    check(c3.state === "review" && c3.tag === "Not sent" && c3.review?.title === "3 castaways, not sent" && c3.review.first && c3.review.answerId === null && /No games on it yet/.test(c3.review.line), "Season 3: staged and never sent, a first send", JSON.stringify(c3.review));
    let ib = await inbox();
    check(ib.length === 1 && ib[0].title === "ZT DC Show 3's cast isn't in its games" && ib[0].line === "3 castaways, not sent · no games on it yet" && ib[0].href === `/desk/season/${ids.s3}/cast`, "the Inbox: Season 3's cast, to its page", JSON.stringify(ib));

    // ---- 3. Paste it ----
    const qn = await as.desk.call("GET", `${P(ids.s1)}/question`);
    check(qn.status === 200 && /List the full starting cast of ZT DC Show 1 of "ZT DC Show"/.test(qn.body.prompt) && /startingGroup/.test(qn.body.prompt) && /tribe/i.test(qn.body.prompt), "its question: our bot's cast prompt, with tribes", (qn.body.prompt || "").slice(0, 200));
    let r = await post(ids.s1, { paste: PASTE });
    check(r.status === 200 && r.body.text === "Pasted: 1 new spelling, 1 starting tribe, 1 new, 1 not listed, not sent", "pasted: staged, saying what it changes", JSON.stringify(r.body));
    check(JSON.stringify(await castNames(ids.s1)) === JSON.stringify(CAST), "nothing written into the cast");
    c1 = await read(ids.s1);
    const kinds = c1.review?.changes.map((x) => `${x.change.k}:${x.change.k === "spell" ? x.change.to : x.change.name}`);
    check(c1.state === "review" && c1.tag === "Not sent" && c1.review.title === "Your paste: 4 changes, not sent" && !c1.review.first && /keeps? the cast as it was sent/.test(c1.review.line), "Season 1: not sent, your paste's 4 changes", JSON.stringify({ t: c1.review?.title, l: c1.review?.line }));
    check(JSON.stringify(kinds) === JSON.stringify(["group:Brady Booker", "spell:Kristian Chavez", "add:Zed Newman", "gone:Devin Way"]), "a tribe, a new spelling, someone new, someone not listed", JSON.stringify(kinds));
    const brady = c1.review.changes.find((x) => x.change.k === "group");
    check(brady.change.from === "Savu" && brady.change.to === "Toka" && brady.note === "We have Savu." && !!brady.photo, "the tribe: what we have", JSON.stringify(brady));
    check(/^From a paste · pasted (today|just now)/i.test(c1.meta) && /sent \w{3} \d{1,2} to 1 game$/.test(c1.meta), "where it came from: a paste, and when it was sent", c1.meta);
    check(c1.history[0]?.text === "Pasted: 1 new spelling, 1 starting tribe, 1 new, 1 not listed, not sent" && c1.history[0].who === U("desk"), "its History line", JSON.stringify(c1.history[0]));
    sp = (await as.desk.call("GET", `/api/desk/seasons/${ids.s1}`)).body;
    check(sp.castRow.need && sp.castRow.line === "Your paste: 1 new spelling, 1 starting tribe, 1 new, 1 not listed · not sent to its games", "the season page's row: its dot and what changed", JSON.stringify(sp.castRow));
    ib = await inbox();
    const it1 = ib.find((i) => i.href === `/desk/season/${ids.s1}/cast`);
    check(!!it1 && it1.title === "ZT DC Show 1's cast: a paste has changes" && it1.line === "1 new spelling, 1 starting tribe, 1 new, 1 not listed · not sent to its 1 game yet", "the Inbox: Season 1's paste, with changes not sent", JSON.stringify(it1));
    const bad = await Promise.all([post(ids.s1, { paste: "" }), post(ids.s1, { paste: "no json here" }), post(ids.s1, { paste: '{"castaways": []}' }), post(ids.s1, {})]);
    check(bad.every((x) => x.status === 400), "refused: nothing pasted, no JSON, nobody in it, nothing asked", bad.map((x) => `${x.status} ${x.body.error}`).join(" | "));

    // ---- 4. Send to its games ----
    const answerId = c1.review.answerId;
    let pv = await post(ids.s1, { send: true, answer: answerId, picks: {}, preview: true });
    let L = (pv.body.lines || []).map((l) => `${l.label} | ${l.change}`);
    check(pv.status === 200 && pv.body.title === "Send to its 1 game?" && JSON.stringify(L) === JSON.stringify(["Cristian Chavez | Renamed Kristian", "Zed Newman | Joins as nobody's", "Teams, picks and results | Stay as they are", "Castaways in each game | 9, from 8"]), "the preview as it defaults: Same person, Keep Savu", JSON.stringify(L));
    const picks = { [`group:${ids.cast["Brady Booker"]}`]: "theirs" };
    pv = await post(ids.s1, { send: true, answer: answerId, picks, preview: true });
    L = (pv.body.lines || []).map((l) => `${l.label} | ${l.change}`);
    check(L.includes("Brady | Starts on Toka") && pv.body.lines[0].face?.name === "Cristian Chavez", "Use Toka: Brady starts on Toka; faces on the changes", JSON.stringify(L));
    check((await post(ids.s1, { send: true, answer: crypto.randomUUID(), picks })).status === 409 && (await post(ids.s1, { send: true, answer: null, picks })).status === 409, "a stale answer: refused");
    const before = await leagueState();
    const cristianId = before.castaways.find((x) => x.name === "Cristian Chavez").id;
    r = await post(ids.s1, { send: true, answer: answerId, picks });
    check(r.status === 200 && !!r.body.changeId && r.body.text === "Sent · its game has the cast", "sent", JSON.stringify(r.body));
    const sendId = r.body.changeId;
    let st = await leagueState();
    const kristian = st.castaways.find((x) => x.seasonCastId === ids.cast["Cristian Chavez"]);
    check(kristian?.name === "Kristian Chavez" && kristian.id === cristianId, "the rename by id: the same castaway in the game, renamed", JSON.stringify(kristian));
    check(st.castaways.find((x) => x.name === "Brady Booker").ownerIds.length === 1, "jo's team keeps Brady");
    const zed = st.castaways.find((x) => x.name === "Zed Newman");
    check(!!zed && !(zed.ownerIds || []).length && !!zed.seasonCastId && st.castaways.length === 9, "Zed joins the game as nobody's; Devin stays", JSON.stringify(zed));
    check((await pool.query("SELECT tribe_name FROM season_cast WHERE id = $1", [ids.cast["Brady Booker"]])).rows[0].tribe_name === "Toka", "Brady starts on Toka");
    c1 = await read(ids.s1);
    check(c1.state === "sent" && c1.review === null && c1.history[0].text === "Sent to its 1 game: 1 rename, 1 joining, 1 starting tribe" && c1.history[0].undoable, "In the games; its History line, with Undo", JSON.stringify(c1.history[0]));
    check(!(await inbox()).some((i) => i.href.includes(ids.s1)) && !(await as.desk.call("GET", `/api/desk/seasons/${ids.s1}`)).body.castRow.need, "off the Inbox, and no dot");
    check((await pool.query("SELECT field FROM season_cast_changes WHERE season_id = $1 ORDER BY changed_at", [ids.s1])).rows.map((x) => x.field).join() === "name,tribe,added", "each change in the cast's own log");
    r = await undoIt(sendId);
    st = await leagueState();
    check(r.status === 200 && JSON.stringify(await castNames(ids.s1)) === JSON.stringify(CAST) && st.castaways.find((x) => x.id === cristianId).name === "Cristian Chavez" && !st.castaways.some((x) => x.name === "Zed Newman"), "Undo: the cast as it was sent, in the game too", JSON.stringify(r.body));
    check((await pool.query("SELECT tribe_name FROM season_cast WHERE id = $1", [ids.cast["Brady Booker"]])).rows[0].tribe_name === "Savu" && (await read(ids.s1)).state === "review", "Brady back on Savu; the paste waits to be sent again");
    r = await post(ids.s1, { send: true, answer: answerId, picks: {} });
    st = await leagueState();
    st.castaways.find((x) => x.name === "Zed Newman").ownerIds = [ids.player];
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [ids.league, JSON.stringify(st)]);
    const refusedUndo = await undoIt(r.body.changeId);
    check(refusedUndo.status === 409 && /Zed Newman is on a team or in a result in ZT DC Game/.test(refusedUndo.body.error) && (await castNames(ids.s1)).includes("Zed Newman"), "Undo refused once someone who joined is on a team", JSON.stringify(refusedUndo.body));
    r = await post(ids.s1, { paste: SAME });
    check(r.status === 200 && r.body.text === "Pasted: nothing changed" && (await read(ids.s1)).state === "sent", "a paste that changes nothing: nothing to send", JSON.stringify(r.body));

    // ---- 5. Ask our bot; a first send ----
    r = await post(ids.s2, { ask: true });
    check(r.status === 200 && /^(Asking ChatGPT for ZT DC Show 2's cast · about a minute|Queued: ZT DC Show 2's cast)$/.test(r.body.text), "Ask our bot: queued, asking", JSON.stringify(r.body));
    const again = await post(ids.s2, { ask: true });
    check(again.status === 200 && /^Already asking for ZT DC Show 2's cast/.test(again.body.text), "the same ask again: joined", JSON.stringify(again.body));
    check((await read(ids.s2)).asking !== null, "the page says it's asking");
    check(await drained(), "the queue drained");
    check(bot.asked.filter((a) => a.kind === "cast").length === 1 && /ZT DC Show 2/.test(bot.asked[0].prompt), "our bot was asked once, for Season 2's cast");
    let c2b = await read(ids.s2);
    check(c2b.state === "review" && c2b.review.title === "Our bot's answer: 5 changes, not sent" && c2b.review.changes.every((x) => x.change.k === "add") && c2b.asking === null, "its answer staged: everyone new", JSON.stringify({ s: c2b.state, t: c2b.review?.title }));
    check(c2b.history.map((h) => h.text).join(" / ") === "Our bot's answer: 5 castaways in 2 tribes, not sent / Asked our bot for the cast", "History: the ask, and its answer", c2b.history.map((h) => h.text).join(" / "));
    check((await as.desk.call("GET", "/api/desk/inbox")).body.items.some((i) => i.title === "ZT DC Show 2's cast: our bot's answer has changes" && i.line === "5 new · no games on it yet"), "the Inbox: our bot's answer");
    pv = await post(ids.s2, { send: true, answer: c2b.review.answerId, preview: true });
    L = (pv.body.lines || []).map((l) => `${l.label} | ${l.change}`);
    check(pv.body.title === "Send it?" && L[0] === "5 new castaways | Join as nobody's" && L[L.length - 1] === "Castaways in each game | 5", "Send's preview with no games: 5 join", JSON.stringify(L));
    r = await post(ids.s2, { send: true, answer: c2b.review.answerId });
    const s2row = (await pool.query("SELECT cast_approved_at, cast_size FROM show_seasons WHERE id = $1", [ids.s2])).rows[0];
    check(r.status === 200 && (await castNames(ids.s2)).length === 5 && !!s2row.cast_approved_at && s2row.cast_size === 5 && (await read(ids.s2)).detail === "5 castaways · 2 tribes", "sent: Season 2 has its cast, approved", JSON.stringify(s2row));
    await undoIt(r.body.changeId);
    check((await castNames(ids.s2)).length === 0 && !(await pool.query("SELECT cast_approved_at FROM show_seasons WHERE id = $1", [ids.s2])).rows[0].cast_approved_at && (await read(ids.s2)).state === "review", "Undo: no cast again, the answer waiting");
    bot.down = true;
    r = await post(ids.s2, { ask: true });
    check(r.status === 503 && /isn't answering/.test(r.body.error), "the bot down: refused, nothing queued", JSON.stringify(r.body));
    bot.down = false;
    botAnswer = "Sorry, I couldn't find that.";
    await post(ids.s2, { ask: true });
    await drained();
    check(/^Asked our bot for the cast: it failed \(There's no JSON object/.test((await read(ids.s2)).history[0].text), "an answer it can't read: History says so", (await read(ids.s2)).history[0].text);
    botAnswer = S2;
    r = await post(ids.s3, { send: true, answer: null, preview: true });
    L = (r.body.lines || []).map((l) => `${l.label} | ${l.change}`);
    check(L[0] === "3 castaways in the cast | Join its games", "Season 3's first send: everyone joins", JSON.stringify(L));
    r = await post(ids.s3, { send: true, answer: null });
    check(r.status === 200 && !!(await pool.query("SELECT cast_approved_at FROM show_seasons WHERE id = $1", [ids.s3])).rows[0].cast_approved_at && (await read(ids.s3)).history[0].text === "Sent: 3 castaways", "sent: approved", (await read(ids.s3)).history[0]?.text);
    await undoIt(r.body.changeId);
    check(!(await pool.query("SELECT cast_approved_at FROM show_seasons WHERE id = $1", [ids.s3])).rows[0].cast_approved_at && (await castNames(ids.s3)).length === 3, "Undo: staged again, its three kept");
    // Only the latest send standing undoes: sent, then a paste adding Dee sent again, then the first send's Undo.
    const sendA = (await post(ids.s3, { send: true, answer: null })).body.changeId;
    await post(ids.s3, { paste: castAnswer([["Ada Example"], ["Bo Example"], ["Cy Example"], ["Dee Newer"]]) });
    const sendB = (await post(ids.s3, { send: true, answer: (await read(ids.s3)).review.answerId })).body.changeId;
    r = await undoIt(sendA);
    check(r.status === 409 && /sent again since/.test(r.body.error) && (await castNames(ids.s3)).length === 4, "an older send's Undo: refused while a later one stands", JSON.stringify(r.body));
    check((await undoIt(sendB)).status === 200 && (await undoIt(sendA)).status === 200 && (await castNames(ids.s3)).length === 3, "the later one's, then the older one's: as it was");

    // ---- 6. screens ----
    // Season 1 back to its paste waiting: the sent paste's send undone needs Zed off the team.
    st = await leagueState();
    st.castaways.find((x) => x.name === "Zed Newman").ownerIds = [];
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [ids.league, JSON.stringify(st)]);
    const lastSend = (await pool.query("SELECT id FROM admin_changes WHERE entity_id = $1 AND action = 'cast' AND undo IS NOT NULL AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1", [ids.s1])).rows[0].id;
    check((await undoIt(lastSend)).status === 200 && (await castNames(ids.s1)).length === 8, "(Zed off the team: that send undone)");
    await pool.query("DELETE FROM season_cast_answers WHERE season_id = $1", [ids.s1]);

    const d = await open({ user: U("desk"), pass: PASSWORD, width, height: 844, headers });
    closers.push(d.close);
    await d.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const failed = [];
    d.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await d.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const pg = d.page;
    let n = 0;
    const shot = async (name, fullPage = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage });
    };
    const fits = async (where) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re) => {
      try {
        await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const dialog = () => sheet().innerText();

    // The season page's row, to the Cast page
    await pg.goto(`${BASE}/desk/season/${ids.s1}`);
    const castRow = pg.locator("[data-desk-row='cast']");
    await castRow.waitFor({ timeout: 30000 });
    check(/8 castaways · in its game/.test(await castRow.innerText()) && (await castRow.locator("[data-off]").count()) === 0 && (await pg.locator("[data-castaway]").count()) === 0, "the season page: Running it › Cast with its line (the faces moved to the Cast page)", await castRow.innerText());
    await castRow.click();
    await pg.locator("[data-desk-cast='sent']").waitFor({ timeout: 30000 });
    check(pg.url().endsWith(`/desk/season/${ids.s1}/cast`), "to the Cast page", pg.url());
    const lt = await pg.locator("[data-lower-third]").innerText();
    check(/In the games/i.test(lt) && /8 castaways · 2 tribes/.test(lt), "its lower third: In the games, 8 castaways · 2 tribes", lt);
    check((await pg.locator("[data-desk-row='cast-ask']").count()) === 1 && (await pg.locator("[data-desk-row='cast-paste']").count()) === 1 && (await pg.locator("[data-group]").count()) === 2, "Getting it: Ask our bot again, Paste it; its two tribes");
    check((await pg.locator("[data-cast-group='Toka'] [data-castaway]").count()) === 4 && /Out · Ep 1/.test(await pg.locator("[data-castaway='Aaliyah Puglia']").innerText()), "the castaways by tribe; Aaliyah Out · Ep 1");
    check((await pg.locator("[data-delete-row='season']").count()) === 1, "the season's Delete");
    await fits("the Cast page");
    await shot("cast");
    await shot("cast-full", true);

    // Paste it: Ask an AI, then What changed
    await pg.locator("[data-desk-row='cast-paste']").click();
    await pg.locator("a[data-ai-open][href]").waitFor({ timeout: 20000 });
    let t = await dialog();
    check(/ZT DC Show 1's cast/i.test(t) && /Open in ChatGPT/.test(t), "Paste it: Ask an AI on the cast's question", t.slice(0, 300));
    await shot("paste");
    await pg.locator("[data-ai-copy]").first().click();
    await pg.locator("[data-ai-answer]").waitFor({ timeout: 10000 });
    await pg.locator("[data-ai-answer]").fill(PASTE);
    await pg.locator("[data-ai-use]").click();
    await pg.locator("[data-cast-diff]").waitFor({ timeout: 30000 });
    await pg.waitForTimeout(600);
    t = await dialog();
    check(/What changed/i.test(t) && /your paste/i.test(t) && /Kristian Chavez/.test(t) && /A new spelling of Cristian Chavez\?/.test(t) && /Same person/.test(t) && /The answer says Brady started on Toka/.test(t) && /Keep Savu/.test(t) && /Zed Newman/.test(t) && /Devin Way/.test(t) && /Not in this answer/.test(t), "What changed: each change, with its choice", t.slice(0, 700));
    await fits("What changed");
    await shot("what-changed");
    await sheet().locator(`[data-change-key='group:${ids.cast["Brady Booker"]}'] [data-pick='theirs']`).click();
    check((await sheet().locator(`[data-change-key='group:${ids.cast["Brady Booker"]}'] [data-pick='theirs']`).getAttribute("aria-checked")) === "true", "Use Toka chosen");
    await sheet().locator(`[data-change-key='spell:${ids.cast["Cristian Chavez"]}'] [data-pick='new']`).click();
    check(/Kristian Chavez joins every game as nobody's, beside Cristian/.test(await dialog()), "Someone new says what it does");
    await sheet().locator(`[data-change-key='spell:${ids.cast["Cristian Chavez"]}'] [data-pick='same']`).click();
    await shot("what-changed-picked");
    await sheet().locator("[data-cast-send]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 30000 });
    await pg.waitForTimeout(600);
    t = await dialog();
    check(/Send to its 1 game\?/i.test(t) && /Renamed Kristian/.test(t) && /Starts on Toka/.test(t) && /Joins as nobody's/.test(t) && /Stay as they are/.test(t) && /9, from 8/.test(t) && /Undo from History puts the cast back/.test(t), "Send's preview: what moves", t.slice(0, 600));
    await fits("Send's preview");
    await shot("send");
    await pg.locator("[data-guard-confirm]").click();
    check(/Sent · its game has the cast/.test(await toasted(/Sent/)), "sent");
    await pg.locator("[data-desk-cast='sent']").waitFor({ timeout: 20000 });
    check((await pool.query("SELECT name FROM season_cast WHERE id = $1", [ids.cast["Cristian Chavez"]])).rows[0].name === "Kristian Chavez" && (await pool.query("SELECT tribe_name FROM season_cast WHERE id = $1", [ids.cast["Brady Booker"]])).rows[0].tribe_name === "Toka", "Kristian renamed, Brady on Toka");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /Undone/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 20000 });
    await pg.locator("[data-desk-cast='review']").waitFor({ timeout: 20000 });
    check(JSON.stringify(await castNames(ids.s1)) === JSON.stringify(CAST), "Undo from the toast: as it was sent, the paste waiting again");
    await shot("waiting-again");

    // The Inbox's item, to the page
    await pg.goto(`${BASE}/desk`);
    const item = pg.locator("[data-desk-item='cast']", { hasText: "ZT DC Show 1" });
    await item.waitFor({ timeout: 30000 });
    check(/a paste has changes/i.test(await item.innerText()) && /not sent to its 1 game yet/.test(await item.innerText()), "the Inbox's item: a paste with changes not sent", await item.innerText());
    await item.click();
    await pg.locator("[data-desk-cast='review'] [data-cast-review]").waitFor({ timeout: 30000 });
    check(pg.url().endsWith(`/desk/season/${ids.s1}/cast`) && /Your paste: 4 changes, not sent/.test(await pg.locator("[data-cast-review]").innerText()), "to the Cast page, the review leading", pg.url());
    await fits("a cast not sent");
    await shot("not-sent");

    // Season 2: no cast, Ask our bot for it
    await pg.goto(`${BASE}/desk/season/${ids.s2}/cast`);
    await pg.locator("[data-desk-cast]").waitFor({ timeout: 30000 });
    await pool.query("DELETE FROM season_cast_answers WHERE season_id = $1", [ids.s2]);
    await pg.reload();
    await pg.locator("[data-desk-cast='none'] [data-cast-none]").waitFor({ timeout: 30000 });
    check(/No cast/i.test(await pg.locator("[data-lower-third]").innerText()) && /Ask our bot for it/.test(await pg.locator("[data-cast-ask]").innerText()) && /Paste it/.test(await pg.locator("[data-cast-paste]").innerText()), "Season 2: No cast; Ask our bot for it, or Paste it");
    await fits("no cast");
    await shot("no-cast");
    bot.delayMs = 4000;
    await pg.locator("[data-cast-ask]").click();
    check(/ZT DC Show 2's cast/.test(await toasted(/cast/)), "asked: the toast says so");
    await pg.locator("[data-cast-asking]").waitFor({ timeout: 15000 });
    check(/our bot/i.test(await pg.locator("[data-cast-asking]").innerText()), "the page says it's asking", await pg.locator("[data-cast-asking]").innerText());
    await shot("asking");
    await pg.locator("[data-desk-cast='review'] [data-cast-see]").waitFor({ timeout: 60000 });
    check(/Our bot's answer: 5 changes, not sent/.test(await pg.locator("[data-cast-review]").innerText()), "its answer lands: the review leads");
    await pg.locator("[data-cast-see]").click();
    await pg.locator("[data-cast-diff]").waitFor({ timeout: 10000 });
    check((await sheet().locator("[data-change='add']").count()) === 5, "What changed: everyone new");
    await fits("everyone new");
    await shot("everyone-new");

    check(failed.filter((f) => !/^(400|404|409|503) /.test(f)).length === 0, "no failed requests", failed.join(", "));
    check(d.errors.length === 0, "no page errors", `${d.errors.join(" | ")} [${failed.join(", ")}]`);
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const cl of closers.reverse()) await cl().catch(() => {});
    if (!keep) await down(pool).catch((er) => console.error("down failed", er));
    const realAfter = (await pool.query(REAL)).rows[0];
    check(realAfter.cast === realBefore.cast && realAfter.answers === realBefore.answers, "no real season's cast or answers moved");
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
