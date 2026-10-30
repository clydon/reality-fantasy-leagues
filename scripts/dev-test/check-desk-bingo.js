// Dev-only check for a season's Bingo bank on the desk (docs/PLAN-desk-parity.md step 4, part 4c), against this lane's dev
// server, on a fixture of its own (zt_db_ people: zt_db_desk a site admin, zt_db_jo, zt_db_sam, zt_db_kim and zt_db_lee who
// play; the ZT DB Show, Season 1 airing weekly at 8 PM Eastern, ten episodes, 1-5 aired and 6 in six days, no cast, the bot
// off). Episode 6 has a bank our bot wrote (Run now, by the desk's admin): 14 squares, 12 past its check; jo and sam flagged
// "Someone quits the game" (out: two flags), jo alone "It rains at camp", and the desk hid "A fake idol gets made"; jo's and
// sam's cards are dealt from it. Episode 3 (aired) has a bank from the bot's schedule; the season's bank is 9 squares the
// desk pasted. The ask-AI bot is never asked (Write them again only opens Run now).
//   1. Only site admins: zt_db_jo is refused the page, its question and every change.
//   2. The read: the strip (Ep 7 to 1, then the season's, each with what deals), Episode 6's bank (who wrote it, how many
//      passed, its squares by tier and what's out, flags and who sent them, cards dealt), the season's, an aired episode
//      with none, one to come with none (Bingo isn't in its schedule), History; the season page's Bingo bank line; the
//      episode page's Bingo row.
//   3. Hide and Show it again: Show it again outranks two flags (back on new cards; one flag since leaves it, two since take
//      it out again), Undo; Hide (an admin's flag, out at once), Undo; an admin's hide shown again; the refusals.
//   4. Paste squares: its question; the preview (what fits, what's left out, nothing written); filed, not checked, who
//      pasted it, History; Undo; refusals (aired, too few, no JSON, no bank).
//   5. In the browser at --width: the season page's row to the page; the strip; a flagged square's sheet and Show it again
//      with Undo; Hide it with Undo; Write them again opens Run now on the episode; the season's bank and Paste squares
//      (Ask an AI, what it keeps, Save) with Undo; an aired episode with none; one to come with none; the episode page's
//      Bingo row and a bingo run's sheet open the bank on their episode. Nothing wider than the screen; the season's Delete
//      last; no page errors.
//   6. Nothing real moved: no real season's squares or flags.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-bingo.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-bingo.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_db_ accounts (their sessions, cards, flags), the ZT DB Show and its season (its banks, cards, runs cascade), and
// the admin_changes lines its desk admin makes; --keep leaves it up. Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-bingo runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-bingo.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_db_${k}`;
const SHOW = "zt-db-show";
const NAME = "ZT DB Show";
const SEASON = `${NAME} 1`;

// Episode 6's bank: [label, likelihood, dropped's note].
const EP6 = [
  ["Someone fishes and catches nothing", "likely"],
  ["It rains at camp", "likely"],
  ["A whisper huddle at the well", "likely"],
  ["Tree mail arrives", "likely"],
  ["Someone hunts for an idol at night", "maybe"],
  ["A fake idol gets made", "maybe"],
  ["A medic checks someone", "maybe"],
  ["Someone is called a snake", "maybe"],
  ["A reward of food is won", "maybe"],
  ["A tribe swap", "longshot"],
  ["A medical evacuation", "longshot"],
  ["Someone quits the game", "longshot"],
  ["Jeff says come on in", "likely", "too sure: it happens every episode"],
  ["Something surprising happens", "maybe", "too vague to settle"],
];
const SEASON_BANK = ["Someone talks strategy at the well", "A challenge ends in a puzzle", "Someone eats something gross", "The tribe argues over the fire", "An idol is found", "A reward trip", "A blindside", "A tie at Tribal", "A fire-making challenge"];
const EP3 = ["A storm hits camp", "Someone cries in a confessional", "A puzzle decides it", "A hug after a win", "An idol is played", "Someone is blindsided"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_db\\_%'`);
  const ids = users.map((u) => u.id);
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id IN (SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2)`,
    [ids, SHOW]
  );
  await pool.query("DELETE FROM ai_briefs WHERE created_by = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_db\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-db-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-db.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["jo", "sam", "kim", "lee"]) await add(k);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  ids.show = (await one("INSERT INTO shows (slug, name, kind, created_by, set_up_at) VALUES ($1, $2, 'competition', $3, now()) RETURNING id", [SHOW, NAME, ids.desk])).id;
  // Episodes 1-5 aired (29, 22, 15, 8 and 1 days ago), 6 in six days.
  ids.season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_count)
     VALUES ($1, 1, 'airing', current_date - 29, '20:00', 'America/New_York', 'weekly', 10) RETURNING id`,
    [ids.show]
  )).id;
  // Episode 6's bank, from our bot's Run now (by the desk's admin) a day ago.
  ids.run6 = (await one(
    `INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, started_at, finished_at, ok, message, seconds, asked_by)
     VALUES ($1, 6, 'now', 'bingo', now() - interval '1 day 4 minutes', now() - interval '1 day', true, '12 of 14 squares passed', 214, $2) RETURNING id`,
    [ids.season, ids.desk]
  )).id;
  await pool.query("INSERT INTO desk_runs (season_id, episode_number, kind, asked_by, asked_at, run_id, done_at, ok) VALUES ($1, 6, 'bingo', $2, now() - interval '1 day 5 minutes', $3, now() - interval '1 day', true)", [ids.season, ids.desk, ids.run6]);
  ids.sq = {};
  for (const [label, likelihood, note] of EP6) {
    ids.sq[label] = (await one(
      `INSERT INTO bingo_squares (season_id, episode, label, likelihood, status, note, run_id, created_at) VALUES ($1, 6, $2, $3, $4, $5, $6, now() - interval '1 day') RETURNING id`,
      [ids.season, label, likelihood, note ? "dropped" : "live", note ?? null, ids.run6]
    )).id;
  }
  // Episode 3's, from its schedule; the season's own, pasted by the desk's admin.
  ids.run3 = (await one(
    `INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, started_at, finished_at, ok, message, seconds) VALUES ($1, 3, 'bingo@1440', 'bingo', now() - interval '16 days', now() - interval '16 days', true, '6 of 6 squares passed', 200) RETURNING id`,
    [ids.season]
  )).id;
  for (const [i, label] of EP3.entries())
    await pool.query("INSERT INTO bingo_squares (season_id, episode, label, likelihood, status, run_id, created_at) VALUES ($1, 3, $2, $3, 'live', $4, now() - interval '16 days')", [ids.season, label, ["likely", "maybe", "longshot"][i % 3], ids.run3]);
  ids.seasonSquares = [];
  for (const [i, label] of SEASON_BANK.entries())
    ids.seasonSquares.push((await one("INSERT INTO bingo_squares (season_id, episode, label, likelihood, status, pasted_by, created_at) VALUES ($1, NULL, $2, $3, 'live', $4, now() - interval '20 days') RETURNING id", [ids.season, label, ["likely", "maybe", "maybe", "longshot"][i % 4], ids.desk])).id);
  // The flags: two on "quits" (out), one on "rains", the desk's own on "fake idol" (hidden).
  const flag = (label, who, hoursAgo) => pool.query("INSERT INTO bingo_square_flags (square_id, user_id, flagged_at) VALUES ($1, $2, now() - make_interval(hours => $3))", [ids.sq[label], ids[who], hoursAgo]);
  await flag("Someone quits the game", "jo", 3);
  await flag("Someone quits the game", "sam", 2);
  await flag("It rains at camp", "jo", 5);
  await flag("A fake idol gets made", "desk", 1);
  // Two cards dealt from it (rerolled, so kept), "quits" on both.
  const card = (who, labels) =>
    pool.query("INSERT INTO bingo_cards (user_id, season_id, episode, squares, rerolls) VALUES ($1, $2, 6, $3::jsonb, 1)", [
      ids[who], ids.season, JSON.stringify([...labels.map((l) => ({ key: `b:${ids.sq[l]}`, label: l })), { key: "free", label: "Free" }]),
    ]);
  await card("jo", ["Someone fishes and catches nothing", "It rains at camp", "A whisper huddle at the well", "Someone hunts for an idol at night", "A medic checks someone", "Someone is called a snake", "A reward of food is won", "Someone quits the game"]);
  await card("sam", ["Tree mail arrives", "It rains at camp", "A whisper huddle at the well", "A fake idol gets made", "A medic checks someone", "Someone is called a snake", "A tribe swap", "Someone quits the game"]);
  return ids;
}

const REAL = `SELECT md5(coalesce(string_agg(q.id || q.label || q.status, ',' ORDER BY q.id), '')) AS sq,
    (SELECT md5(coalesce(string_agg(f.square_id || f.user_id, ',' ORDER BY f.square_id, f.user_id), '')) FROM bingo_square_flags f
       JOIN bingo_squares b ON b.id = f.square_id JOIN show_seasons ss ON ss.id = b.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%') AS flags
  FROM bingo_squares q JOIN show_seasons ss ON ss.id = q.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

/** A chat's answer: `n` squares, `long` of them too long for a square. */
function squaresAnswer(n, long = 0, word = "Square") {
  const squares = Array.from({ length: n }, (_, i) => ({
    square: i < long ? `${word} ${i + 1} is a square far too long to ever fit on a bingo card` : `${word} ${i + 1} comes up`,
    likelihood: ["likely", "maybe", "longshot"][i % 3],
  }));
  return "```json\n" + JSON.stringify({ squares }) + "\n```";
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_db_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL)).rows[0];
  const closers = [];
  try {
    const ids = await up(pool);
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD }), jo: await api({ user: U("jo"), pass: PASSWORD }) };
    const P = `/api/desk/seasons/${ids.season}/bingo`;
    const read = async (bank) => (await as.desk.call("GET", `${P}${bank != null ? `?bank=${bank}` : ""}`)).body;
    const sqOf = (b, label) => b.bank.squares.find((s) => s.label === label);
    const undoIt = (changeId) => as.desk.call("POST", `/api/desk/changes/${changeId}/undo`, {});
    const row = async (label) => (await pool.query("SELECT shown_at, shown_by FROM bingo_squares WHERE id = $1", [ids.sq[label]])).rows[0];
    const adminFlags = async (label) => (await pool.query(`SELECT count(*)::int AS n FROM bingo_square_flags f JOIN "user" u ON u.id = f.user_id WHERE f.square_id = $1 AND u.role = 'admin'`, [ids.sq[label]])).rows[0].n;

    // ---- 1. only site admins ----
    const refused = [
      await as.jo.call("GET", P),
      await as.jo.call("GET", `${P}/question?bank=7`),
      await as.jo.call("POST", P, { bank: 7, paste: squaresAnswer(30), preview: true }),
      await as.jo.call("POST", P, { square: ids.sq["It rains at camp"], hide: true }),
    ];
    check(refused.every((r) => r.status === 403), "a player is refused the page, its question and every change", refused.map((r) => r.status).join(","));

    // ---- 2. the read ----
    const b = await read();
    check(b.sel === 6 && b.tag === "Ready" && b.detail === "Episode 6: 10 squares" && /Episode 6's dealt to 2 people so far\.$/.test(b.meta), "the next episode's bank first: Ready, 10 squares, dealt to 2", JSON.stringify({ sel: b.sel, tag: b.tag, d: b.detail, m: b.meta }));
    check(JSON.stringify(b.strip) === JSON.stringify([7, 6, 5, 4, 3, 2, 1, "season"].map((x) => ({ bank: x, squares: { 6: 10, 3: 6, season: 9 }[x] ?? null }))), "the strip: Ep 7 to 1, then the season's, each with what deals", JSON.stringify(b.strip));
    check(b.bank.by === "Our bot, Run now by you" && b.bank.check === "12 of 14 passed its check" && b.bank.bot && b.bank.dealt === 2 && /^Yesterday, /.test(b.bank.at), "who wrote it, when, how many passed its check", JSON.stringify({ by: b.bank.by, c: b.bank.check, at: b.bank.at, d: b.bank.dealt }));
    const quits = sqOf(b, "Someone quits the game");
    check(quits.state === "flagged" && quits.tier === "longshot" && quits.flags.map((f) => f.name).join() === "zt_db_jo,zt_db_sam" && quits.cards === 2, "two flags: out of new cards, who sent them, on both cards", JSON.stringify(quits));
    check(sqOf(b, "It rains at camp").state === "live" && sqOf(b, "It rains at camp").flags.length === 1 && sqOf(b, "A fake idol gets made").state === "hidden" && sqOf(b, "A fake idol gets made").hiddenBy === "you" && sqOf(b, "A fake idol gets made").flags.length === 0, "one flag stays in; the desk's hide is Hidden by you, not a flag");
    check(sqOf(b, "Jeff says come on in").state === "dropped" && sqOf(b, "Jeff says come on in").note === "too sure: it happens every episode", "dropped by its check, with why");
    check(b.panel.title === "Episode 6" && !b.panel.aired && b.panel.empty === null && b.writing === false, "its panel: Episode 6, still to come");
    const season = await read("season");
    check(season.sel === "season" && season.bank.by === "You pasted them" && season.bank.check === "9 pasted, not checked" && !season.bank.bot && season.panel.aside === "For any episode without its own", "the season's bank: pasted by you, not checked", JSON.stringify({ by: season.bank.by, c: season.bank.check }));
    const e3 = await read(3);
    check(e3.bank.by === "Our bot, on its schedule" && e3.panel.aired && e3.bank.check === "6 of 6 passed its check", "Episode 3 (aired): from its schedule; no writing for it");
    const e4 = await read(4);
    check(e4.bank === null && e4.panel.aired && /^Episode 4 had no squares of its own: its cards used the season's bank\./.test(e4.panel.empty.line), "Episode 4 (aired, none): its cards used the season's", JSON.stringify(e4.panel));
    const e7 = await read(7);
    check(e7.bank === null && !e7.panel.aired && e7.panel.empty.title === "No squares for Episode 7 yet" && /^Bingo isn't in ZT DB Show 1's schedule/.test(e7.panel.empty.line), "Episode 7 (none yet): Bingo isn't in its schedule", JSON.stringify(e7.panel));
    check((await read("x")).sel === 6 && (await as.desk.call("GET", `/api/desk/seasons/${crypto.randomUUID()}/bingo`)).status === 404, "a bank that isn't one: the default; a season that isn't: 404");
    const H = b.history.map((h) => h.text);
    check(H.includes("“Someone quits the game” out: two flags") && H.includes("Episode 6's squares written, by our bot (Run now, by you)") && H.includes("Episode 3's squares written, by our bot (on its schedule)"), "History: the bot's banks and the square two flags took out", H.join(" / "));
    check(H.indexOf("“Someone quits the game” out: two flags") === 0, "newest first");
    const e9 = await read(9);
    check(e9.sel === 9 && e9.strip[0].bank === 9 && e9.strip.length === 10 && e9.bank === null, "a later episode asked for (from its page): the strip reaches it", JSON.stringify(e9.strip.map((y) => y.bank)));
    check((await read(11)).sel === 6, "past the season's ten: the default");
    const seasonPage = (await as.desk.call("GET", `/api/desk/seasons/${ids.season}`)).body;
    check(seasonPage.bingo?.line === "Episode 6: 10 squares · the season's: 9", "the season page's Bingo bank line", seasonPage.bingo?.line);
    const ep6 = (await as.desk.call("GET", `/api/desk/seasons/${ids.season}/episodes/6`)).body;
    check(ep6.bingo === 10 && /^Our bot, Run now by you · Yesterday, /.test(ep6.bingoBy || ""), "the episode page's Bingo row: its squares, who wrote them and when", JSON.stringify({ b: ep6.bingo, by: ep6.bingoBy }));

    // ---- 3. Hide, and Show it again ----
    let r = await as.desk.call("POST", P, { square: ids.sq["Someone quits the game"], hide: false });
    check(r.status === 200 && r.body.changeId && r.body.text === "Shown again · back on new cards", "Show it again on two flags", JSON.stringify(r.body));
    let x = sqOf(await read(6), "Someone quits the game");
    check(x.state === "live" && x.shownBy === "you" && x.flags.length === 2 && x.flags.every((f) => f.overruled) && (await row("Someone quits the game")).shown_by === ids.desk, "back on new cards: your call outranks their two flags (listed as overruled)", JSON.stringify(x));
    const showId = r.body.changeId;
    await pool.query("INSERT INTO bingo_square_flags (square_id, user_id) VALUES ($1, $2)", [ids.sq["Someone quits the game"], ids.kim]);
    check(sqOf(await read(6), "Someone quits the game").state === "live", "one flag since: still on new cards");
    await pool.query("INSERT INTO bingo_square_flags (square_id, user_id) VALUES ($1, $2)", [ids.sq["Someone quits the game"], ids.lee]);
    check(sqOf(await read(6), "Someone quits the game").state === "flagged", "two since: out again");
    await pool.query("DELETE FROM bingo_square_flags WHERE square_id = $1 AND user_id = ANY($2::text[])", [ids.sq["Someone quits the game"], [ids.kim, ids.lee]]);
    r = await undoIt(showId);
    check(r.status === 200 && sqOf(await read(6), "Someone quits the game").state === "flagged" && (await row("Someone quits the game")).shown_at === null, "Undo: out again on its two flags", JSON.stringify(r.body));
    r = await as.desk.call("POST", P, { square: ids.sq["It rains at camp"], hide: true });
    x = sqOf(await read(6), "It rains at camp");
    check(r.status === 200 && r.body.text === "Hidden · out of new cards" && x.state === "hidden" && x.hiddenBy === "you" && x.flags.length === 1, "Hide it: out of new cards at once (your flag, not counted as a player's)", JSON.stringify(x));
    await undoIt(r.body.changeId);
    check(sqOf(await read(6), "It rains at camp").state === "live" && (await adminFlags("It rains at camp")) === 0, "Undo: back on new cards");
    // An Undo once the square has moved on since: refused, the later change stands.
    const hideA = (await as.desk.call("POST", P, { square: ids.sq["It rains at camp"], hide: true })).body.changeId;
    const showB = (await as.desk.call("POST", P, { square: ids.sq["It rains at camp"], hide: false })).body.changeId;
    r = await undoIt(hideA);
    check(r.status === 409 && sqOf(await read(6), "It rains at camp").state === "live", "Undo of a hide after a later Show it again: refused, the show stands", JSON.stringify(r.body));
    await undoIt(showB);
    check(sqOf(await read(6), "It rains at camp").state === "hidden" && (await undoIt(hideA)).status === 200 && sqOf(await read(6), "It rains at camp").state === "live", "Undo the show, then the hide: as it was");
    r = await as.desk.call("POST", P, { square: ids.sq["A fake idol gets made"], hide: false });
    check(r.status === 200 && sqOf(await read(6), "A fake idol gets made").state === "live" && (await adminFlags("A fake idol gets made")) === 0, "Show it again on one you hid: your flag goes");
    await undoIt(r.body.changeId);
    check(sqOf(await read(6), "A fake idol gets made").state === "hidden" && (await adminFlags("A fake idol gets made")) === 1, "Undo: hidden again");
    const no = [
      await as.desk.call("POST", P, { square: ids.sq["Jeff says come on in"], hide: true }),
      await as.desk.call("POST", P, { square: ids.sq["A fake idol gets made"], hide: true }),
      await as.desk.call("POST", P, { square: "nope", hide: true }),
      await as.desk.call("POST", P, { square: ids.sq["It rains at camp"], hide: "yes" }),
      await as.desk.call("POST", P, { square: crypto.randomUUID(), hide: true }),
    ];
    check(no.map((y) => y.status).join() === "400,409,400,400,404", "refused: a dropped one, one already out, not a square, not true or false, not in the bank", no.map((y) => `${y.status} ${y.body.error}`).join(" | "));
    check((await as.desk.call("GET", `/api/desk/seasons/${ids.season}/bingo?bank=6`)).body.history.filter((h) => /hidden|shown again/.test(h.text)).length === 5, "each in History");

    // ---- 4. Paste squares ----
    const q = await as.desk.call("GET", `${P}/question?bank=7`);
    check(q.status === 200 && /bingo squares/i.test(q.body.prompt || "") && /episode 7|Episode 7/.test(q.body.prompt || "") && !!q.body.task, "Paste squares' question: the bot's own prompt for Episode 7");
    const answer = squaresAnswer(30, 3);
    const pv = await as.desk.call("POST", P, { bank: 7, paste: answer, preview: true });
    const pl = pv.body.lines || [];
    check(pv.status === 200 && pl[0]?.label === "30 squares pasted" && pl[0]?.change === "27 fit on cards" && pl.some((l) => l.label === "3 too long for a square" && l.change === "Left out") && !pl.some((l) => l.change === "Replaced"), "the preview: 30 pasted, 27 fit, 3 too long", JSON.stringify(pl));
    check((await pool.query("SELECT count(*)::int AS n FROM bingo_squares WHERE season_id = $1 AND episode = 7", [ids.season])).rows[0].n === 0, "the preview wrote nothing");
    const pv6 = await as.desk.call("POST", P, { bank: 6, paste: answer, preview: true });
    check((pv6.body.lines || []).some((l) => l.label === "Episode 6's 10 squares" && l.change === "Replaced"), "on a bank that has squares: what it replaces", JSON.stringify(pv6.body));
    r = await as.desk.call("POST", P, { bank: 7, paste: answer });
    const b7 = await read(7);
    check(r.status === 200 && r.body.text === "Saved · 27 squares for Episode 7" && b7.bank.by === "You pasted them" && b7.bank.check === "27 pasted, not checked" && b7.bank.squares.length === 30, "filed: 27 on cards, not checked, pasted by you", JSON.stringify({ t: r.body.text, by: b7.bank?.by, c: b7.bank?.check }));
    check(b7.history.some((h) => h.text === "Episode 7's squares pasted, by you: 27" && h.undoable), "its History line, with Undo");
    await undoIt(r.body.changeId);
    check((await read(7)).bank === null, "Undo: Episode 7 has none again");
    const bad = [
      await as.desk.call("POST", P, { bank: 4, paste: answer, preview: true }),
      await as.desk.call("POST", P, { bank: 7, paste: squaresAnswer(5), preview: true }),
      await as.desk.call("POST", P, { bank: 7, paste: "no json here", preview: true }),
      await as.desk.call("POST", P, { bank: "x", paste: answer, preview: true }),
      await as.desk.call("POST", P, { bank: 7, paste: "", preview: true }),
    ];
    check(bad.every((y) => y.status === 400) && /has aired/.test(bad[0].body.error) && /Only 5 of 5 squares fit/.test(bad[1].body.error), "refused: an aired episode, too few, no JSON, no bank, nothing pasted", bad.map((y) => `${y.status} ${y.body.error}`).join(" | "));

    // ---- 5. screens ----
    const d = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
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
    const undo = async () => {
      await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
      await pg.waitForFunction(() => /Undone/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 20000 });
    };
    const shut = async () => {
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(400);
    };
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const dialog = () => sheet().innerText();
    const tile = (label) => pg.locator(`[data-square='${ids.sq[label]}']`);

    // The season page's row
    await pg.goto(`${BASE}/desk/season/${ids.season}`);
    const bingoRow = pg.locator("[data-desk-row='bingo']");
    await bingoRow.waitFor({ timeout: 30000 });
    check(/Bingo bank/.test(await bingoRow.innerText()) && /Episode 6: 10 squares · the season's: 9/.test(await bingoRow.innerText()), "the season page: Running it › Bingo bank, with its line", await bingoRow.innerText());
    await bingoRow.click();
    await pg.locator("[data-desk-bingo='6'] [data-bank]").waitFor({ timeout: 30000 });
    check(pg.url().endsWith(`/desk/season/${ids.season}/bingo`), "to the Bingo bank page", pg.url());
    check(/Ready/i.test(await pg.locator("[data-lower-third]").innerText()) && /Episode 6: 10 squares/.test(await pg.locator("[data-lower-third]").innerText()), "its lower third: Ready, Episode 6: 10 squares");
    check(/Ep 6\s*10/.test(await pg.locator("[data-bank-chip='6']").innerText()) && (await pg.locator("[data-bank-chip='6']").getAttribute("aria-selected")) === "true" && (await pg.locator("[data-bank-chip]").count()) === 8, "the strip: Episode 6 chosen, 10 on it, eight chips");
    check(/Our bot, Run now by you · Yesterday, .*\n?12 of 14 passed its check/.test(await pg.locator("[data-bank-line]").innerText()), "who wrote it, and how many passed", await pg.locator("[data-bank-line]").innerText());
    check((await pg.locator("[data-tier='likely'] [data-square]").count()) === 4 && (await pg.locator("[data-tier='maybe'] [data-square]").count()) === 4 && (await pg.locator("[data-tier='longshot'] [data-square]").count()) === 2 && (await pg.locator("[data-tier='out'] [data-square]").count()) === 4, "squares by Likely 4, Maybe 4, Long shot 2, Out of new cards 4");
    check(/Two flags/i.test(await tile("Someone quits the game").innerText()) && /Hidden by you/i.test(await tile("A fake idol gets made").innerText()) && /1 flag/i.test(await tile("It rains at camp").innerText()) && /Dropped/i.test(await tile("Jeff says come on in").innerText()), "each tile's tag: two flags, hidden by you, 1 flag, dropped");
    await fits("the Bingo bank");
    await shot("bank");
    await shot("bank-full", true);
    // The season's Delete, last
    const lastSection = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-desk-bingo] > *")];
      return rows[rows.length - 1]?.querySelector("[data-delete-row]")?.getAttribute("data-delete-row") ?? rows[rows.length - 1]?.getAttribute("data-delete-row") ?? null;
    });
    const delRow = pg.locator("[data-delete-row='season']");
    check((await delRow.count()) === 1 && /Delete ZT DB Show 1/.test(await delRow.innerText()), "the season's Delete row", String(lastSection));

    // A flagged square: Show it again, and its Undo
    await tile("Someone quits the game").click();
    await sheet().locator("[data-square-sheet]").waitFor({ timeout: 10000 });
    let t = await dialog();
    check(/A square/i.test(t) && /Episode 6 · Long shot/.test(t) && /Someone quits the game/i.test(t) && /Dealt on 2 of the 2 cards so far/.test(t) && /Out of new cards: two people flagged it/.test(t), "its sheet: the plate, where it's dealt, why it's out", t.slice(0, 400));
    check(/Flagged as unfair/i.test(t) && /zt_db_jo/.test(t) && /zt_db_sam/.test(t) && /Show it again/.test(t) && /you overrule its two flags/.test(t), "its flags and who sent them; Show it again overrules them", t.slice(0, 600));
    await fits("a square's sheet");
    await shot("square-flagged");
    await sheet().locator("[data-square-toggle]").click();
    check(/Shown again · back on new cards/.test(await toasted(/Shown again/)), "shown again");
    await pg.locator(`[data-tier='longshot'] [data-square='${ids.sq["Someone quits the game"]}']`).waitFor({ timeout: 15000 });
    check((await row("Someone quits the game")).shown_by === ids.desk, "back in Long shot, shown by you");
    await undo();
    await pg.locator(`[data-tier='out'] [data-square='${ids.sq["Someone quits the game"]}']`).waitFor({ timeout: 15000 });
    check((await row("Someone quits the game")).shown_at === null, "Undo: out again");
    // Hide a live one, and its Undo
    await tile("Tree mail arrives").click();
    await sheet().locator("[data-square-toggle]").waitFor({ timeout: 10000 });
    t = await dialog();
    check(/Hide it from new cards/.test(t) && /Out of new cards, as two flags would put it/.test(t) && /Dealt on 1 of the 2 cards so far/.test(t), "a live square: Hide it from new cards", t.slice(0, 400));
    await shot("square-live");
    await sheet().locator("[data-square-toggle]").click();
    check(/Hidden · out of new cards/.test(await toasted(/Hidden/)), "hidden");
    await pg.locator(`[data-tier='out'] [data-square='${ids.sq["Tree mail arrives"]}']`).waitFor({ timeout: 15000 });
    check((await adminFlags("Tree mail arrives")) === 1, "your flag on it");
    await undo();
    await pg.locator(`[data-tier='likely'] [data-square='${ids.sq["Tree mail arrives"]}']`).waitFor({ timeout: 15000 });
    check((await adminFlags("Tree mail arrives")) === 0, "Undo: back on new cards");
    // A dropped one: nothing to hide
    await tile("Something surprising happens").click();
    await sheet().locator("[data-square-sheet]").waitFor({ timeout: 10000 });
    t = await dialog();
    check(/Its check dropped it: too vague to settle/.test(t) && (await sheet().locator("[data-square-toggle]").count()) === 0 && /Writing them again, or a paste, replaces the bank/.test(t), "a dropped square: why, and no Hide");
    await shut();
    // Write them again: Run now on Episode 6
    await pg.locator("[data-bank-write]").click();
    await pg.locator("[data-now-episode='6']").waitFor({ timeout: 30000 });
    t = await dialog();
    check(/Bingo squares, now/i.test(t) && (await pg.locator("[data-now-episode='6']").getAttribute("aria-checked")) === "true" && /replace Episode 6's/.test(t), "Write them again: Run now on Episode 6, what it replaces", t.slice(0, 400));
    await shot("write-again");
    await shut();

    // The season's bank, and Paste squares with its Undo
    await pg.locator("[data-bank-chip='season']").click();
    await pg.locator("[data-desk-bingo='season'] [data-bank]").waitFor({ timeout: 20000 });
    check(pg.url().endsWith("/bingo?bank=season") && /You pasted them/.test(await pg.locator("[data-bank-line]").innerText()) && /9 pasted, not checked/.test(await pg.locator("[data-bank-line]").innerText()), "the season's bank: the URL keeps it; pasted by you, not checked");
    await shot("season-bank");
    await pg.locator("[data-bank-paste]").click();
    await pg.locator("a[data-ai-open][href]").waitFor({ timeout: 20000 });
    t = await dialog();
    check(/Squares for the season/i.test(t) && /naming nobody/.test(t) && /Open in ChatGPT/.test(t), "Paste squares: Ask an AI, for the season (naming nobody)", t.slice(0, 300));
    await fits("Paste squares");
    await shot("paste");
    await pg.locator("[data-ai-copy]").first().click();
    await pg.locator("[data-ai-answer]").waitFor({ timeout: 10000 });
    await pg.locator("[data-ai-answer]").fill(squaresAnswer(30, 3, "Season square"));
    await pg.locator("[data-ai-use]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 30000 });
    t = await dialog();
    check(/Save these squares\?/i.test(t) && /30 squares pasted/.test(t) && /27 fit on cards/.test(t) && /3 too long for a square/.test(t) && /The season's 9 squares/.test(t) && /Replaced/.test(t) && /A paste isn't checked by a second ask/.test(t), "what it keeps, leaves out and replaces, before it's saved", t.slice(0, 500));
    await fits("the paste's preview");
    await shot("paste-preview");
    await pg.locator("[data-guard-confirm]").click();
    check(/Saved · 27 squares for the season/.test(await toasted(/Saved/)), "saved");
    const pasted = (await pool.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE pasted_by = $2)::int AS mine FROM bingo_squares WHERE season_id = $1 AND episode IS NULL", [ids.season, ids.desk])).rows[0];
    check(pasted.n === 30 && pasted.mine === 30, "the season's bank: the 30 pasted, by you", JSON.stringify(pasted));
    await pg.locator("[data-bank-line]", { hasText: "27 pasted, not checked" }).waitFor({ timeout: 15000 });
    await undo();
    const back = (await pool.query("SELECT id FROM bingo_squares WHERE season_id = $1 AND episode IS NULL ORDER BY id", [ids.season])).rows.map((y) => y.id);
    check(JSON.stringify(back) === JSON.stringify([...ids.seasonSquares].sort()), "Undo: the old nine back, the same squares", JSON.stringify(back));
    // An aired episode with none, and one to come with none
    await pg.locator("[data-bank-chip='4']").click();
    await pg.locator("[data-desk-bingo='4'] [data-bank-none]").waitFor({ timeout: 20000 });
    check(/Episode 4 had no squares of its own/.test(await pg.locator("[data-bank-none]").innerText()) && (await pg.locator("[data-bank-write]").count()) === 0, "Episode 4: none of its own, and nothing to write");
    await pg.locator("[data-bank-chip='7']").click();
    await pg.locator("[data-desk-bingo='7'] [data-bank-empty]").waitFor({ timeout: 20000 });
    check(/No squares for Episode 7 yet/i.test(await pg.locator("[data-bank-empty]").innerText()) && /Write them now/.test(await pg.locator("[data-bank-write]").innerText()), "Episode 7: none yet, Write them now or Paste squares");
    await fits("an episode with none");
    await shot("none-yet");

    // The episode page's Bingo row, and a bingo run's sheet, open the bank on their episode
    await pg.goto(`${BASE}/desk/season/${ids.season}/e/6`);
    const epRow = pg.locator("[data-desk-row='bingo']");
    await epRow.waitFor({ timeout: 30000 });
    check(/10 squares of its own/.test(await epRow.innerText()) && /Our bot, Run now by you · Yesterday/.test(await epRow.innerText()), "the episode page's Bingo row: its squares, who wrote them", await epRow.innerText());
    await epRow.click();
    await pg.locator("[data-desk-bingo='6'] [data-bank]").waitFor({ timeout: 30000 });
    check(pg.url().endsWith("/bingo?bank=6"), "to its bank", pg.url());
    await pg.goto(`${BASE}/desk/season/${ids.season}/research`);
    await pg.locator(`[data-run='${ids.run6}']`).click({ timeout: 30000 });
    await pg.locator("[data-desk-row='run-bingo']").waitFor({ timeout: 10000 });
    check(/Episode 6's squares/.test(await pg.locator("[data-desk-row='run-bingo']").innerText()) && /The bingo bank/.test(await pg.locator("[data-desk-row='run-bingo']").innerText()), "a bingo run's sheet: Episode 6's squares");
    await pg.locator("[data-desk-row='run-bingo']").click();
    await pg.locator("[data-desk-bingo='6'] [data-bank]").waitFor({ timeout: 30000 });
    check(pg.url().endsWith("/bingo?bank=6"), "to its bank", pg.url());

    check(failed.filter((f) => !/^(400|404|409) /.test(f)).length === 0, "no failed requests", failed.join(", "));
    check(d.errors.length === 0, "no page errors", `${d.errors.join(" | ")} [${failed.join(", ")}]`);
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const cl of closers.reverse()) await cl().catch(() => {});
    if (!keep) await down(pool).catch((er) => console.error("down failed", er));
    const realAfter = (await pool.query(REAL)).rows[0];
    check(realAfter.sq === realBefore.sq && realAfter.flags === realBefore.flags, "no real season's squares or flags moved");
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
