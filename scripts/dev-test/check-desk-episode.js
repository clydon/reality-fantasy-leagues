// Dev-only check for an episode's page on the desk (docs/PLAN-desk-parity.md step 4, part 4b), against this lane's dev server,
// on a fixture of its own (zt_de_ people: zt_de_desk a site admin who has seen through Episode 3, zt_de_jo who runs the ZT DE
// Couch's one game; the ZT DE Show, Season 1 airing weekly at 8 PM Eastern, Episodes 1-5 aired and 6 in six days, the
// Survivor 51 showcase cast). Episode 5 has three answers (jo's quick check and paste, and our bot's Run now) and eight
// results: Carter voted out and two tribe immunities in every game from more than one source, Kristin's journey from one
// sure source; Kristin's idol and Ori's advantage waiting (one source, not sure), "Lynnea" waiting (nobody in the cast is
// called that), and Eric's idol disputed (a player's flag). Episode 4 is settled; Episode 3 has nothing. Two trivia questions
// were written after Episode 5 (one its check dropped). The ask-AI bot is never asked (Ask our bot only opens its sheet).
//   1. Only site admins: zt_de_jo is refused the page, its question and every change.
//   2. The read: Final, who went home, each result where it belongs and why, the answers, trivia, an episode that hasn't
//      aired, one past the season; the season page's Episodes and Research's Not in the games yet; the paste's preview
//      (what it confirms, what it splits) and Take it back's (what only it reported), nothing written.
//   3. In the browser at --width: the season page's rows to the episode; Hide names on by itself (Episode 5 unseen), counts
//      only; Accept all's sheet; Who? (the guess picked), corrected; ✓ (into the game's state) and its Undo; Accept all and
//      its Undo; ✕ and Put it back; Take it out of every game (tier 2); an answer's sheet and Take it back (tier 2) with
//      Undo; Paste an answer (the plain Ask an AI, what it adds, Add it) and its Undo; trivia's Take it out and Put it
//      back; Ask our bot and Write trivia now open Run now on the episode; Research's Not in the games yet and a run's
//      link; Episode 6 (hasn't aired); Clear only what's waiting and its Undo; Clear everything (hold): out of the game too.
//      Nothing wider than the screen; Clear last; no page errors.
//   4. Nothing real moved: no real season's results or answers.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-episode.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-episode.js --down        (takes the fixture down, nothing else)
//
// up/down: zt_de_ accounts (their sessions, follows), the ZT DE Show and its season (its cast, results, answers, trivia,
// runs cascade), the couch and its game, and the admin_changes lines its desk admin makes; --keep leaves it up. Refuses a
// non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-episode runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-episode.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_de_${k}`;
const SHOW = "zt-de-show";
const NAME = "ZT DE Show";
const SEASON = `${NAME} 1`;
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const CAST = FACES.map(nameOf);
const TRIBES = [["toka", "Toka", "#e0b23a"], ["savu", "Savu", "#9b6bd0"], ["dina", "Dina", "#f3214a"]];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_de\\_%'`);
  const ids = users.map((u) => u.id);
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id IN (
       SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2
       UNION SELECT d.id::text FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2)`,
    [ids, SHOW]
  );
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-de-%'");
  await pool.query("DELETE FROM couches WHERE name = 'ZT DE Couch'");
  await pool.query("DELETE FROM ai_briefs WHERE created_by = ANY($1::text[])", [ids]);
  // The show's answers live by show and season number (no foreign key to the season).
  await pool.query("DELETE FROM episode_research WHERE show_id IN (SELECT id FROM shows WHERE slug = $1)", [SHOW]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_de\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-de-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-de.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  await add("jo");
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  ids.show = (await one("INSERT INTO shows (slug, name, kind, created_by, set_up_at) VALUES ($1, $2, 'competition', $3, now()) RETURNING id", [SHOW, NAME, ids.desk])).id;
  // Episodes 1-5 aired (29, 22, 15, 8 and 1 days ago), 6 in six days.
  ids.season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_count, cast_approved_at)
     VALUES ($1, 1, 'airing', current_date - 29, '20:00', 'America/New_York', 'weekly', 10, now()) RETURNING id`,
    [ids.show]
  )).id;
  for (const [i, slug] of FACES.entries()) {
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)", [
      ids.season, nameOf(slug), TRIBES[i % 3][1], `/mock/showcase/img/survivor-51/${slug}.jpg`, i,
    ]);
  }
  // The couch and its one game, results through Episode 4 (the demo builder's: the i-th of the cast out in Episode i+1).
  ids.couch = (await one("INSERT INTO couches (name, created_by) VALUES ('ZT DE Couch', $1) RETURNING id", [ids.jo])).id;
  const state = JSON.parse(JSON.stringify(buildDemoState({
    id: "zt-de", showId: SHOW, showName: NAME, seasonName: SEASON, episodeCount: 10,
    players: [{ key: "jo", name: "jo", color: "#888" }, { key: "sam", name: "sam", color: "#888" }],
    groups: TRIBES.map(([key, name, color]) => ({ key, name, color })),
    castaways: FACES.map((slug, i) => ({ key: `k${i}`, name: nameOf(slug), placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`, groupKey: TRIBES[i % 3][0], exitEpisode: Math.min(i + 1, 10), exitMethod: "Voted Out" })),
  }, "pickem", 4)));
  S.migrateLeagueState(state);
  state.settings.showId = SHOW;
  state.settings.wikiSeason = 1;
  ids.league = (await one("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('ZT DE Game', 'zt-de-game', 'ZTDEGM', $1, $2, $3) RETURNING id", [JSON.stringify(state), ids.jo, ids.couch])).id;
  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, 'commissioner', 5)", [ids.league, ids.jo, state.players[0].id]);
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'owner')", [ids.couch, ids.jo]);
  await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 5), ($3, $2, 3)", [ids.jo, ids.season, ids.desk]);

  // The answers: [key, episode, source, by, covers, minutes after the episode's air time + a day].
  const sub = async (n, source, by, covers, hoursAgo) =>
    (await one(
      `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers, researched_at)
       VALUES ($1, 1, $2, '{}'::jsonb, $3::jsonb, $4, $5, $6, $7::jsonb, now() - make_interval(hours => $8)) RETURNING id`,
      [ids.show, n, JSON.stringify({ provider: source }), source, by, by ? ids.couch : null, JSON.stringify(covers), hoursAgo]
    )).id;
  const all = { people: CAST, kinds: null };
  const without = (...names) => ({ people: CAST.filter((c) => !names.includes(c)), kinds: null });
  ids.a1 = await sub(5, "quick", ids.jo, { people: CAST, kinds: ["elimination"] }, 20);
  ids.a2 = await sub(5, "paste", ids.jo, without("Ori Jean Charles"), 12);
  ids.a3 = await sub(5, "autopilot", null, without("Kristin Flickinger", "Eric Macksoud"), 10);
  ids.b1 = await sub(4, "paste", ids.jo, all, 160);
  ids.b2 = await sub(4, "autopilot", null, all, 158);
  // Our bot's answer was a Run now (its run's row names it).
  ids.run = (await one(
    `INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, started_at, finished_at, ok, message, result, seconds)
     VALUES ($1, 5, 'now', 'full', now() - interval '10 hours 3 minutes', now() - interval '10 hours', true, '9 of 12 result(s) in every league', $2::jsonb, 164) RETURNING id`,
    [ids.season, JSON.stringify({ submission: ids.a3, live: 9 })]
  )).id;
  await pool.query("INSERT INTO desk_runs (season_id, episode_number, kind, asked_by, asked_at, run_id, done_at, ok) VALUES ($1, 5, 'full', $2, now() - interval '10 hours 4 minutes', $3, now() - interval '10 hours', true)", [ids.season, ids.desk, ids.run]);

  // The results: [episode, kind, who, method, event, status, fact_status, [answer, confidence]...].
  const fact = async (n, kind, who, method, event, status, factStatus, said) => {
    const id = (await one(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, decided_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CASE WHEN $7 = 'accepted' THEN now() END, clock_timestamp()) RETURNING id`,
      [ids.season, n, kind, who, method, event, status, factStatus]
    )).id;
    for (const [rid, conf] of said) await pool.query("INSERT INTO fact_sources (decision_id, research_id, method, confidence) VALUES ($1, $2, $3, $4)", [id, rid, method, conf]);
    return id;
  };
  ids.carter = await fact(5, "elimination", "Carter Krull", "Voted Out", "", "accepted", "confirmed", [[ids.a1, "high"], [ids.a2, "high"], [ids.a3, "high"]]);
  ids.danny = await fact(5, "event", "Danny Kilby", "", "tribeImmunity", "accepted", "confirmed", [[ids.a2, "high"], [ids.a3, "high"]]);
  ids.lewis = await fact(5, "event", "Lewis Kelly", "", "tribeImmunity", "accepted", "confirmed", [[ids.a2, "high"], [ids.a3, "high"]]);
  ids.journey = await fact(5, "event", "Kristin Flickinger", "", "wentOnJourney", "accepted", "reported", [[ids.a2, "high"]]);
  ids.idol = await fact(5, "event", "Kristin Flickinger", "", "idolFound", "pending", "reported", [[ids.a2, "low"]]);
  ids.ori = await fact(5, "event", "Ori Jean Charles", "", "learnedOfAdvantage", "pending", "reported", [[ids.a3, "medium"]]);
  ids.lynnea = await fact(5, "event", "Lynnea", "", "learnedOfAdvantage", "pending", "reported", [[ids.a3, "low"]]);
  ids.eric = await fact(5, "event", "Eric Macksoud", "", "idolFound", "pending", "disputed", [[ids.a2, "high"]]);
  await pool.query("INSERT INTO fact_disputes (season_id, episode_number, decision_id, user_id, couch_id, reason, note) VALUES ($1, 5, $2, $3, $4, 'didnt-happen', '')", [ids.season, ids.eric, ids.jo, ids.couch]);
  ids.brady = await fact(4, "elimination", "Brady Booker", "Voted Out", "", "accepted", "confirmed", [[ids.b1, "high"], [ids.b2, "high"]]);
  await fact(4, "event", "Danny Kilby", "", "rewardWin", "accepted", "confirmed", [[ids.b1, "high"], [ids.b2, "high"]]);

  // Trivia written after Episode 5: one asked, one its check dropped.
  ids.q1 = (await one(
    `INSERT INTO trivia_questions (season_id, made_after, episode, kind, question, options, answer, source, status) VALUES ($1, 5, 5, 'cast', 'Who went on the journey in Episode 5?', '[]', 'Kristin', 'https://example.com/recap', 'live') RETURNING id`,
    [ids.season]
  )).id;
  await pool.query(
    `INSERT INTO trivia_questions (season_id, made_after, episode, kind, question, options, answer, source, status, note) VALUES ($1, 5, 5, 'cast', 'Who did Carter vote for?', '[]', 'Kristin', 'https://example.com/recap', 'dropped', 'the recaps disagree')`,
    [ids.season]
  );
  return ids;
}

const REAL = `SELECT md5(coalesce(string_agg(d.id || d.status || coalesce(d.fact_status, '') || coalesce(d.locked_at::text, ''), ',' ORDER BY d.id), '')) AS d,
    (SELECT count(*) FROM episode_research er JOIN shows s ON s.id = er.show_id WHERE s.slug NOT LIKE 'zt-%' AND er.withdrawn_at IS NULL) AS answers
  FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

/** A full answer from the question's own skeleton: everyone "no", Carter voted out, Kristin found an idol, Ori learned of one. */
function fullAnswer(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode five.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  const who = (name) => a.castaways.find((c) => c.name === name);
  Object.assign(who("Carter Krull"), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 4 });
  Object.assign(who("Kristin Flickinger"), { foundAdvantage: "yes" });
  Object.assign(who("Ori Jean Charles"), { learnedOfAdvantage: "yes" });
  for (const n of ["Danny Kilby", "Lewis Kelly"]) Object.assign(who(n), { wonTribeImmunity: "yes" });
  return "```json\n" + JSON.stringify(a) + "\n```";
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_de_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL)).rows[0];
  const closers = [];
  try {
    const ids = await up(pool);
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD }), jo: await api({ user: U("jo"), pass: PASSWORD }) };
    const P = `/api/desk/seasons/${ids.season}/episodes`;
    const state = async (fid) => (await pool.query("SELECT status, fact_status, locked_at IS NOT NULL AS locked, applied FROM season_decisions WHERE id = $1", [fid])).rows[0] ?? null;
    const leagueHas = async (type, name, n = 5) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [ids.league]);
      const st = rows[0].state;
      const c = st.castaways.find((x) => x.name === name);
      const ep = st.episodes.find((e) => e.number === n);
      return !!ep && (type === "elimination" ? (ep.events || []).some((e) => e.castawayId === c.id) : (ep.scoringEvents || []).some((e) => e.type === type && e.castawayId === c.id));
    };

    // ---- 1. only site admins ----
    const refused = [
      await as.jo.call("GET", `${P}/5`),
      await as.jo.call("GET", `${P}/5/question`),
      await as.jo.call("POST", `${P}/5`, { acceptAll: true }),
      await as.jo.call("POST", `${P}/5`, { takeBack: ids.a2, preview: true }),
      await as.jo.call("DELETE", `${P}/5?scope=waiting`),
    ];
    check(refused.every((r) => r.status === 403), "a player is refused the page, its question and every change", refused.map((r) => r.status).join(","));

    // ---- 2. the read ----
    const r = await as.desk.call("GET", `${P}/5`);
    const e = r.body;
    const F = (fid) => e.facts.find((f) => f.id === fid);
    check(r.status === 200 && e.tag === "Final" && e.wentHome === "Carter voted out" && e.aired && !e.seen, "Episode 5: Final, Carter voted out, not seen by the desk's admin", JSON.stringify({ s: r.status, tag: e.tag, w: e.wentHome, seen: e.seen }));
    check(e.meta === "4 results in every game · 3 not yet · 1 disputed · from 3 answers", "its line: what's in, what waits, how many answers", e.meta);
    check(F(ids.carter).state === "live" && F(ids.carter).sources === 2 && F(ids.danny).state === "live" && F(ids.journey).state === "live" && F(ids.journey).why === "1 source, sure of it", "in every game: two sources (jo once, however many answers), and one sure one");
    check(F(ids.idol).state === "wait" && /One source \(yours\)|One source \(zt_de_jo's\), and it wasn't sure/.test(F(ids.idol).why) && F(ids.ori).state === "wait", "waiting: one source, and it wasn't sure", F(ids.idol).why);
    check(F(ids.lynnea).state === "wait" && F(ids.lynnea).unknown && F(ids.lynnea).guess === "Linnea Capobianco" && /Nobody called Lynnea is in the cast\. Linnea Capobianco, maybe\?/.test(F(ids.lynnea).why), "a name not in the cast: waiting, with a guess", F(ids.lynnea).why);
    check(F(ids.eric).state === "disputed" && /^Flagged: it didn't happen/.test(F(ids.eric).why), "disputed: a player's flag", F(ids.eric).why);
    const A = (aid) => e.answers.find((a) => a.id === aid);
    check(e.answers.length === 3 && A(ids.a1).title === "Who went home, from zt_de_jo" && A(ids.a2).title === "zt_de_jo pasted an answer" && A(ids.a3).title === "Our bot" && /^Run now, by you · /.test(A(ids.a3).line), "the answers: a quick check, a paste, our bot's Run now", e.answers.map((a) => `${a.title} | ${a.line}`).join(" / "));
    check(A(ids.a3).only.includes(ids.ori) && A(ids.a3).only.includes(ids.lynnea) && !A(ids.a3).only.includes(ids.danny) && A(ids.a2).only.includes(ids.journey), "what only each answer reported");
    check(e.trivia.length === 2 && e.trivia.filter((t) => !t.out).length === 1 && /its check dropped it: the recaps disagree/.test(e.trivia.find((t) => t.out).out), "trivia: one asked, one its check dropped");
    check(e.games === 1 && e.bingo === null && e.resultsBy === "leagues" && e.confirmAt === 2 && e.choices.cast.length === 17 && !e.choices.cast.some((c) => c.name === "Brady Booker"), "its one game, no squares of its own, results from sources; Correct it offers who was still in");
    const e6 = (await as.desk.call("GET", `${P}/6`)).body;
    check(!e6.aired && e6.tag === "Coming up" && e6.endsAt === "9:00 PM" && e6.answers.length === 0, "Episode 6: hasn't aired, ends at 9:00 PM", JSON.stringify({ a: e6.aired, t: e6.tag, end: e6.endsAt }));
    check((await as.desk.call("GET", `${P}/11`)).status === 404 && (await as.desk.call("GET", `${P}/x`)).status === 404, "past the season's ten, or not a number: not here");
    const season = (await as.desk.call("GET", `/api/desk/seasons/${ids.season}`)).body;
    const rows = Object.fromEntries(season.episodeRows.map((x) => [x.n, x.line]));
    check(season.episodeRows[0].n === 6 && / · next$/.test(rows[6]) && /^Aired .* · 3 not in the games yet$/.test(rows[5]) && /in every game$/.test(rows[4]) && /no results yet$/.test(rows[3]), "the season page: the next episode, then each aired one and how it stands", JSON.stringify(season.episodeRows.slice(0, 4)));
    const research = (await as.desk.call("GET", `/api/desk/seasons/${ids.season}/research`)).body;
    check(research.waiting.length === 1 && research.waiting[0].n === 5 && research.waiting[0].count === 3 && research.waiting[0].line === "2 one source wasn't sure of · 1 not in the cast", "Research's Not in the games yet: Episode 5, three", JSON.stringify(research.waiting));
    // Take it back's preview: the paste alone held up Kristin's journey; nothing written.
    const tb = await as.desk.call("POST", `${P}/5`, { takeBack: ids.a2, preview: true });
    check(tb.status === 200 && tb.body.lines.some((l) => l.label === "Kristin Flickinger · Went on a journey" && l.change === "Out of every game") && tb.body.lines.some((l) => /Its 1 game/.test(l.label)), "Take it back's preview: what only it reported leaves every game", JSON.stringify(tb.body));
    check((await state(ids.journey)).status === "accepted" && (await pool.query("SELECT withdrawn_at FROM episode_research WHERE id = $1", [ids.a2])).rows[0].withdrawn_at === null, "the preview wrote nothing");
    // The paste's question, and what an answer would add.
    const q = await as.desk.call("GET", `${P}/5/question`);
    check(q.status === 200 && /Start from this skeleton/.test(q.body.prompt || ""), "Paste an answer's question: the season's checklist as JSON");
    const answer = fullAnswer(q.body.prompt);
    const pv = await as.desk.call("POST", `${P}/5`, { paste: answer, preview: true, confirmed: true });
    const pl = pv.body.lines || [];
    check(pv.status === 200 && pl.some((l) => /Kristin Flickinger · Idol\/advantage found/.test(l.label) && /into every game/.test(l.change)) && pl.some((l) => /Ori Jean Charles · Learned/.test(l.label)), "the paste's preview: Kristin's idol and Ori's advantage confirmed into every game", JSON.stringify(pv.body));
    check(pl.some((l) => /Disputed/.test(l.change)) && pl[0].change === "1 agree with what's in" || pl.some((l) => /agree with what's in/.test(l.change)), "and what it agrees with, and what it splits (Kristin's journey: it says no)", pl.map((l) => `${l.label}: ${l.change}`).join(" / "));
    check((await state(ids.idol)).status === "pending" && (await pool.query("SELECT count(*)::int AS n FROM episode_research WHERE show_id = $1 AND episode_number = 5", [ids.show])).rows[0].n === 3, "the preview wrote nothing");
    check((await as.desk.call("POST", `${P}/5`, { acceptAll: true })).status === 400 && (await as.desk.call("DELETE", `${P}/5?scope=waiting`, {})).status === 400 && (await as.desk.call("POST", `${P}/5`, { acceptAll: [ids.carter] })).status === 409, "Accept all and Clear only what's waiting act on the results the sheet showed (and only those still waiting)");
    check((await as.desk.call("POST", `${P}/5`, { paste: "not an answer", preview: true })).status === 400 && (await as.desk.call("POST", `${P}/6`, { paste: answer, preview: true })).status === 400, "a paste that isn't the answer, or for an episode not aired: refused");

    // ---- 3. screens ----
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
    const row = (fid) => pg.locator(`[data-fact-row='${fid}']`);
    const waitState = async (fid, want) => {
      for (let k = 0; k < 40; k++) {
        const s = await state(fid);
        if (want(s)) return s;
        await pg.waitForTimeout(250);
      }
      return state(fid);
    };

    // The season page's rows, to the episode
    await pg.goto(`${BASE}/desk/season/${ids.season}`);
    await pg.locator("[data-desk-row='episode-5']").waitFor({ timeout: 30000 });
    check(/3 not in the games yet/.test(await pg.locator("[data-desk-row='episode-5']").innerText()) && /next/.test(await pg.locator("[data-episodes] [data-desk-row]").first().innerText()), "the season page: Episodes as rows, the next first");
    await pg.locator("[data-episodes]").scrollIntoViewIfNeeded();
    await shot("season-episodes");
    await pg.locator("[data-desk-row='episode-5']").click();
    await pg.locator("[data-desk-episode='5']").waitFor({ timeout: 30000 });
    check((await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) === SEASON, "Back names the season");

    // Hide names: on by itself, counts only
    check((await pg.locator("[data-desk-episode]").getAttribute("data-hidden")) === "on" && (await pg.locator("[data-waiting-count]").count()) === 1, "Hide names is on by itself for an episode you haven't seen");
    const hiddenText = await pg.locator("[data-desk-episode]").innerText();
    check(!/Carter|Kristin|Lynnea|Danny/.test(hiddenText) && /On: you haven't seen Episode 5 yet/.test(hiddenText) && /2 one source wasn't sure of/.test(hiddenText), "no names anywhere on the page, the counts instead", (hiddenText.match(/.{0,40}(Carter|Kristin|Lynnea|Danny).{0,40}/) || [""])[0]);
    await shot("hidden");
    await pg.locator("[data-hide-names]").click();
    await pg.locator("[data-waiting]").waitFor({ timeout: 10000 });
    check(/Final/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) && /Carter voted out/.test(await pg.locator("[data-lower-third]").innerText()), "names shown: the lower third says who went home");
    check((await row(ids.idol).locator("[data-accept]").count()) === 1 && (await row(ids.lynnea).locator("[data-who]").count()) === 1 && (await row(ids.eric).locator("[data-decide]").count()) === 1, "each waiting row: ✕ ✓, Who?, or Decide");
    check(/Accept 2/i.test(await pg.locator("[data-accept-all]").innerText()) && (await pg.locator("[data-in-games] [data-group]").count()) === 3, "Accept 2 (the stranger waits), and in every game by result");
    await fits("the episode's page");
    await shot("episode");
    await shot("episode-full", true);
    const last = await pg.evaluate(() => [...document.querySelectorAll("section")].filter((s) => s.offsetParent).pop()?.getAttribute("data-delete-row"));
    check(last === "clear-episode", "Clear its results is last", String(last));

    // Accept all's sheet
    await pg.locator("[data-accept-all]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 10000 });
    const allText = await dialog();
    check(/Accept these 2\?/i.test(allText) && /“Lynnea” needs a name first, so it waits/.test(allText) && (await pg.locator("[data-move='Into every game']").count()) === 2 && /Its 1 game/.test(allText), "Accept all: the two, the stranger waiting, its game", allText.slice(0, 300));
    await shot("accept-all");
    await shut();

    // Who? on the stranger: the guess picked, corrected and accepted
    await row(ids.lynnea).locator("[data-who]").click();
    await pg.locator("[data-correct-go]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-who-pick='Linnea Capobianco']").getAttribute("aria-checked")) === "true" && (await pg.locator("[data-what]").inputValue()) === "learnedOfAdvantage", "Who was it?: Linnea picked, what happened as reported");
    await fits("Correct it");
    await shot("who");
    await pg.locator("[data-correct-go]").click();
    check(/Corrected · Linnea · Learned/.test(await toasted(/Corrected/)), "corrected: a toast");
    const ly = await waitState(ids.lynnea, (s) => s.fact_status === "canonical");
    check(ly.fact_status === "canonical" && ly.status === "accepted" && ly.applied?.castawayName === "Linnea Capobianco" && ly.locked, "the fact: Linnea's, canonical and locked", JSON.stringify(ly));
    check(await (async () => { for (let k = 0; k < 20 && !(await leagueHas("learnedOfAdvantage", "Linnea Capobianco")); k++) await pg.waitForTimeout(250); return leagueHas("learnedOfAdvantage", "Linnea Capobianco"); })(), "and in the game's Episode 5");

    // ✓ on Kristin's idol: into the game; Undo
    await row(ids.idol).locator("[data-accept]").click();
    check(/Accepted · in its one game as each player reveals Episode 5/.test(await toasted(/Accepted/)), "✓: accepted, a toast");
    check((await waitState(ids.idol, (s) => s.status === "accepted")).fact_status === "canonical" && (await leagueHas("idolFound", "Kristin Flickinger")), "Kristin's idol: canonical, and in the game");
    await undo();
    check((await waitState(ids.idol, (s) => s.status === "pending")).fact_status === "reported" && !(await leagueHas("idolFound", "Kristin Flickinger")), "Undo: waiting again, out of the game");

    // Accept all, and its Undo
    await pg.locator("[data-accept-all]").waitFor({ timeout: 10000 });
    await pg.locator("[data-accept-all]").click();
    await pg.locator("[data-guard-confirm]").click();
    check(/Accepted 2 · in every game as each player reveals Episode 5/.test(await toasted(/Accepted 2/)), "Accept all: both, a toast");
    check((await waitState(ids.ori, (s) => s.status === "accepted")).fact_status === "canonical" && (await state(ids.idol)).fact_status === "canonical", "both canonical");
    await pg.locator("[data-desk-episode]").getByText("Episode 5: 2 results accepted, by you").first().waitFor({ timeout: 10000 });
    check(true, "a History line");
    await undo();
    check((await waitState(ids.ori, (s) => s.status === "pending")).fact_status === "reported" && (await state(ids.idol)).fact_status === "reported", "Undo: both waiting again");

    // ✕ on Ori's advantage, then Put it back from its sheet
    await row(ids.ori).locator("[data-reject]").waitFor({ timeout: 10000 });
    await row(ids.ori).locator("[data-reject]").click();
    check(/Rejected · it stays out of every game/.test(await toasted(/Rejected/)), "✕: rejected");
    check((await waitState(ids.ori, (s) => s.status === "rejected")).locked, "Ori's advantage: out, locked");
    await pg.locator("[data-gone]").click();
    await pg.locator("[data-group-sheet] [data-desk-row]").first().click();
    await pg.locator("[data-put-back]").waitFor({ timeout: 10000 });
    check(/Out of every game/.test(await dialog()), "its sheet: out of every game");
    await shot("fact-gone");
    await pg.locator("[data-put-back]").click();
    check(/Put back/.test(await toasted(/Put back/)), "Put it back");
    const ori = await waitState(ids.ori, (s) => !s.locked);
    check(ori.status === "pending" && ori.fact_status === "reported", "waiting again, settled from its sources", JSON.stringify(ori));

    // Take a result out of every game (tier 2)
    await pg.locator("[data-group='Tribe/team immunity win']").click();
    await pg.locator("[data-group-sheet] [data-desk-row]", { hasText: "Danny" }).click();
    await pg.locator("[data-take-out]").waitFor({ timeout: 10000 });
    check(/In its one game and the shared stats|In every game · 2 sources agree/.test(await dialog()) && /Says it happened/i.test(await dialog()), "a result in every game: its sources");
    await shot("fact-live");
    await pg.locator("[data-take-out]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 10000 });
    check(/Take it out of every game\?/i.test(await dialog()) && (await pg.locator("[data-move='Out, and locked']").count()) === 1, "Take it out: what moves, first");
    await shot("take-out");
    await pg.locator("[data-guard-confirm]").click();
    check(/Taken out of every game/.test(await toasted(/Taken out/)), "taken out");
    check((await waitState(ids.danny, (s) => s.status === "rejected")).locked, "Danny's immunity: out, locked");

    // An answer's sheet, and Take it back with its Undo
    await pg.locator("[data-answers] [data-desk-row]", { hasText: "Our bot" }).click();
    await pg.locator("[data-take-back]").waitFor({ timeout: 10000 });
    check(/only it reported/i.test(await dialog()) && /Run now, by you/.test(await dialog()) && /It took 2 min 44 s/.test(await dialog()), "our bot's answer: what only it reported, who asked, how long", (await dialog()).slice(0, 400));
    await fits("an answer's sheet");
    await shot("answer");
    await pg.locator("[data-take-back]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 15000 });
    check(/Take it back\?/i.test(await dialog()) && /Gone: nothing else says so|Stay, on one source fewer/.test(await dialog()), "Take it back: what moves, from the server", (await dialog()).slice(0, 400));
    await shot("take-back");
    await pg.locator("[data-guard-confirm]").click();
    check(/Taken back/.test(await toasted(/Taken back/)), "taken back");
    check((await pool.query("SELECT withdrawn_at FROM episode_research WHERE id = $1", [ids.a3])).rows[0].withdrawn_at !== null && (await waitState(ids.ori, (s) => s.fact_status === "removed")).fact_status === "removed", "withdrawn: what only it reported is out");
    await undo();
    check((await pool.query("SELECT withdrawn_at FROM episode_research WHERE id = $1", [ids.a3])).rows[0].withdrawn_at === null && (await waitState(ids.ori, (s) => s.fact_status === "reported")).fact_status === "reported", "Undo: a source again, Ori's advantage waiting again");

    // Research's Not in the games yet, and a run's link to its episode
    await pg.goto(`${BASE}/desk/season/${ids.season}/research`);
    await pg.locator("[data-waiting-episodes] [data-desk-row]").first().waitFor({ timeout: 30000 });
    check(/Episode 5/.test(await pg.locator("[data-waiting-episodes]").innerText()) && /one source wasn't sure of/.test(await pg.locator("[data-waiting-episodes]").innerText()), "Research: Not in the games yet lists Episode 5");
    await pg.locator("[data-waiting-episodes]").scrollIntoViewIfNeeded();
    await shot("research-waiting");
    await pg.locator(`[data-run]`).first().click();
    await pg.locator("[data-desk-row='run-episode']").waitFor({ timeout: 10000 });
    check(/Episode 5's results/.test(await dialog()), "a run's sheet links Episode 5's results");
    await shot("run-link");
    await pg.locator("[data-desk-row='run-episode']").click();
    await pg.locator("[data-desk-episode='5']").waitFor({ timeout: 30000 });
    check(true, "and it opens the episode");
    await pg.locator("[data-hide-names]").click();
    await pg.locator("[data-waiting]").waitFor({ timeout: 10000 });

    // Paste an answer: the plain Ask an AI, what it adds, Add it; Undo
    await pg.locator("[data-paste]").click();
    await pg.locator("a[data-ai-open][href]").waitFor({ timeout: 20000 });
    check(/Episode 5's results/i.test(await dialog()) && /Open in ChatGPT/.test(await dialog()) && !/One tap|\$1/.test(await dialog()), "Paste an answer: the plain Ask an AI (no One tap)");
    await shot("paste");
    await pg.locator("[data-ai-copy]").first().click();
    await pg.locator("[data-ai-answer]").waitFor({ timeout: 10000 });
    await pg.locator("[data-ai-answer]").fill(answer);
    await pg.locator("[data-ai-use]").click();
    await pg.locator("[data-moves]").waitFor({ timeout: 30000 });
    check(/Add it as a source\?/i.test(await dialog()) && /Kristin Flickinger · Idol\/advantage found/.test(await dialog()), "what it adds, before it's filed");
    await fits("the paste's preview");
    await shot("paste-preview");
    await pg.locator("[data-guard-confirm]").click();
    check(/Added · /.test(await toasted(/Added/)), "added");
    check((await waitState(ids.idol, (s) => s.status === "accepted")).fact_status === "confirmed" && (await state(ids.ori)).status === "accepted", "Kristin's idol and Ori's advantage: confirmed, in every game");
    const filed = (await pool.query("SELECT id, source, submitted_by, couch_id FROM episode_research WHERE show_id = $1 AND episode_number = 5 AND source = 'paste' AND submitted_by = $2 AND withdrawn_at IS NULL", [ids.show, ids.desk])).rows;
    check(filed.length === 1 && filed[0].couch_id === null, "filed as the desk's own submission");
    await pg.locator("[data-answers] [data-desk-row]", { hasText: "You pasted an answer" }).waitFor({ timeout: 10000 });
    check(true, "Answers: You pasted an answer");
    await undo();
    check((await waitState(ids.idol, (s) => s.status === "pending")).fact_status === "reported" && (await pool.query("SELECT withdrawn_at FROM episode_research WHERE id = $1", [filed[0].id])).rows[0].withdrawn_at !== null, "Undo: taken back, waiting again");

    // Trivia: Take it out, Put it back
    await pg.locator("[data-trivia] [data-desk-row]", { hasText: "journey" }).click();
    await pg.locator("[data-trivia-out]").waitFor({ timeout: 10000 });
    await shot("trivia");
    await pg.locator("[data-trivia-out]").click();
    check(/Taken out · nobody is asked it/.test(await toasted(/Taken out/)), "trivia: taken out");
    check((await pool.query("SELECT count(*)::int AS n FROM trivia_flags WHERE question_id = $1", [ids.q1])).rows[0].n === 1, "an admin's flag on it");
    await pg.locator("[data-trivia] [data-desk-row]", { hasText: "journey" }).getByText("taken out by an admin").waitFor({ timeout: 10000 });
    await pg.locator("[data-trivia] [data-desk-row]", { hasText: "journey" }).click();
    await pg.locator("[data-trivia-back]").click();
    check(/Back in trivia/.test(await toasted(/Back in trivia/)), "put back");
    check((await pool.query("SELECT count(*)::int AS n FROM trivia_flags WHERE question_id = $1", [ids.q1])).rows[0].n === 0, "its flag gone");

    // Ask our bot: Run now on this episode
    await pg.locator("[data-ask-bot]").click();
    await pg.locator("[data-now-go]").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-now-episode='5']").getAttribute("aria-checked")) === "true" && /Full results, now/i.test(await dialog()), "Ask our bot: Run now, Episode 5 picked");
    await shot("ask-bot");
    await shut();

    // Episode 4: Write trivia now; Episode 6: hasn't aired
    await pg.goto(`${BASE}/desk/season/${ids.season}/e/4`);
    await pg.locator("[data-write-trivia]").waitFor({ timeout: 30000 });
    check(/trivia isn't in ZT DE Show 1's schedule/.test(await pg.locator("[data-trivia-none]").innerText()), "no trivia: why not");
    await pg.locator("[data-write-trivia]").click();
    await pg.locator("[data-now-go]").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-now-episode='4']").getAttribute("aria-checked")) === "true" && /Trivia, now/i.test(await dialog()), "Write trivia now: Run now's trivia, after Episode 4");
    await shut();
    await pg.goto(`${BASE}/desk/season/${ids.season}/e/6`);
    await pg.locator("[data-not-aired]").waitFor({ timeout: 30000 });
    check(/Results come in after it ends at 9:00 PM/.test(await pg.locator("[data-not-aired]").innerText()) && /Coming up/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) && (await pg.locator("[data-delete-row='clear-episode'] button").count()) === 0, "Episode 6: hasn't aired, nothing to clear");
    await shot("not-aired");

    // Clear only what's waiting, and its Undo
    await pg.goto(`${BASE}/desk/season/${ids.season}/e/5`);
    await pg.locator("[data-delete-row='clear-episode'] button").click({ timeout: 30000 });
    await pg.locator("[data-hold]").waitFor({ timeout: 10000 });
    check(/Clear Episode 5's results\?/i.test(await dialog()) && /Its 3 answers and 8 results go/.test(await dialog()) && /The 2 results not in the games go/.test(await dialog()), "Clear: everything, or only what's waiting", (await dialog()).slice(0, 300));
    await fits("Clear's sheet");
    await shot("clear");
    await sheet().getByRole("button", { name: "Clear only what's waiting" }).click();
    check(/Cleared 2 waiting results/.test(await toasted(/Cleared/)), "only what's waiting: cleared");
    check((await state(ids.idol)) === null && (await state(ids.ori)) === null && (await state(ids.carter)).status === "accepted", "the waiting ones gone, what's in the games stays");
    await undo();
    check((await state(ids.idol))?.fact_status === "reported" && (await state(ids.ori))?.fact_status === "reported", "Undo: they're back, waiting");
    // Everything (hold)
    await pg.locator("[data-delete-row='clear-episode'] button").click();
    await pg.locator("[data-hold]").waitFor({ timeout: 10000 });
    await pg.waitForTimeout(600); // the sheet has finished sliding up
    const box = await pg.locator("[data-hold]").boundingBox();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pg.mouse.down();
    await pg.waitForTimeout(1900);
    await pg.mouse.up();
    const heldToast = await toasted(/cleared from every game/);
    check(/Episode 5's results are cleared from every game/.test(heldToast), "held: cleared", `${heldToast} | ${await sheet().innerText().catch(() => "")}`);
    const left = (await pool.query(
      `SELECT (SELECT count(*)::int FROM season_decisions WHERE season_id = $1 AND episode_number = 5) AS facts,
              (SELECT count(*)::int FROM episode_research WHERE show_id = $2 AND episode_number = 5) AS answers,
              (SELECT count(*)::int FROM season_decisions WHERE season_id = $1 AND episode_number = 4) AS four`,
      [ids.season, ids.show]
    )).rows[0];
    check(left.facts === 0 && left.answers === 0 && left.four === 2, "every answer and result of Episode 5 gone; Episode 4's stay", JSON.stringify(left));
    check(!(await leagueHas("elimination", "Carter Krull")) && !(await leagueHas("learnedOfAdvantage", "Linnea Capobianco")), "and out of the game");
    await pg.locator("[data-lower-third='Waiting']").waitFor({ timeout: 15000 });
    check(/No answers yet/.test(await pg.locator("[data-facts]").innerText()), "the page: Waiting, no answers yet");

    check(failed.filter((f) => !/^(400|404|409) /.test(f)).length === 0, "no failed requests", failed.join(", "));
    check(d.errors.length === 0, "no page errors", `${d.errors.join(" | ")} [${failed.join(", ")}]`);
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const cl of closers.reverse()) await cl().catch(() => {});
    if (!keep) await down(pool).catch((er) => console.error("down failed", er));
    const realAfter = (await pool.query(REAL)).rows[0];
    check(realAfter.d === realBefore.d && String(realAfter.answers) === String(realBefore.answers), "no real season's results or answers moved");
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
