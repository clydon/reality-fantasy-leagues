// Dev-only check for research on a rulebook on the desk (docs/PLAN-rulebook-research.md): Check for changes and What
// scores, each asked of our bot or pasted, their answers staged for the page's review. Against this lane's dev server, on a
// fixture of its own (zt_rr_ people: zt_rr_desk a site admin, zt_rr_jo who isn't). The ZT RR Show plays The Challenge's
// rules; its Season 1 is airing (a weekly show five weeks in, 14 episodes, three castaways), so its rulebook is The
// Challenge's built-in blocks. The ask-AI bot is the stand-in (fake-bot.js, through the dev-only x-gys-bot header), never a
// real one.
//   1. Only site admins: zt_rr_jo is refused the page, its questions and every action.
//   2. The read: research offered (our bot, nothing asking, nothing waiting; the admin is up to Episode 3, so Check for changes
//      suggests up to it, 14 at most); the What scores question lists every moment with its id, the ladder, rarity, known from
//      past seasons and the season so far, and reads the whole season whatever's asked; `?prompt=1` is Check for changes' (the
//      rulebook prompt from this rulebook), which can be scoped up to an episode; past the last refused.
//   3. Paste on What scores: an answer that isn't JSON refused; an answer staged (rescored moments with their rungs and rarity, an
//      added-by-hand moment worth nothing dropped, two moments added, a repeat and a name left out, and a new-this-season moment from Episode 9 held with no trace of it), the
//      row's dot, the History line; a paste on Check for changes staged beside it.
//   4. Settled a row at a time: Use (accepted and declined rows settled, the held one keeps the answer open, unseen); past
//      Episode 9 it shows and settles, and the answer is done; Put away; settled twice refused.
//   5. Ask our bot: What scores queued, asked (the stand-in gets the scores question), its answer staged; Check for changes the
//      same (the rulebook question, this rulebook as its template); the bot down refused; a rulebook with no season refused;
//      Check for changes asked up to Episode 3 (the run's episode, the question's scope, the answer's card).
//   6. In the browser at --width: the Research rows; What scores' sheet, Ask our bot, asking (the spinner), the answer's
//      card as it lands (polling) as a pick list (added first, then every moment, two declined), Use 7 changes (the draft has
//      the seven, Discard); Paste it opens Ask an AI's
//      sheet. Nothing wider than the screen; no page errors.
//   7. Nothing real moved: no real rulebook's answers or runs.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-rulebook-research.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-rulebook-research.js --down      (takes the fixture down, nothing else)
//
// up/down: zt_rr_ accounts, the ZT RR Show and its season (its rulebook, answers and runs cascade), a zt-rr library rulebook,
// and the admin_changes lines on them; --keep leaves it up. Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fakeBot = require("./fake-bot");
const { ensureSeasonRulebook } = require("../../db/rulebooks.js");
const { momentsFor } = require("../../src/lib/game/formats/rulebook-moments.js");
const { LADDER } = require("../../src/lib/game/formats/rulebook-scores.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-rulebook-research runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-rulebook-research.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_rr_${k}`;
const SHOW = "zt-rr-show";
const NAME = "ZT RR Show";
const CAST = ["Ava Example", "Ben Example", "Cy Example"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the fixture ----------

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_rr\\_%'`);
  const ids = users.map((u) => u.id);
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id IN (
       SELECT r.id::text FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2
       UNION SELECT r.id::text FROM rulebooks r WHERE r.name = 'zt-rr-library'
       UNION SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2)`,
    [ids, SHOW]
  );
  await pool.query("DELETE FROM rulebooks WHERE name = 'zt-rr-library'");
  await pool.query("DELETE FROM ai_briefs WHERE created_by = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM show_follows WHERE user_id = ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_rr\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-rr-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-rr.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  await add("jo");
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  ids.show = (await one("INSERT INTO shows (slug, name, kind, format, created_by, set_up_at, castaway_term, tribe_term) VALUES ($1, $2, 'competition', 'challenge', $3, now(), 'Challenger', 'Team') RETURNING id", [SHOW, NAME, ids.desk])).id;
  ids.season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_count, cast_approved_at, cast_approved_by)
     VALUES ($1, 1, 'airing', current_date - 35, '20:00', 'America/New_York', 'weekly', 14, now() - interval '40 days', $2) RETURNING id`,
    [ids.show, ids.desk]
  )).id;
  for (const [i, n] of CAST.entries()) await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, $2, $3)", [ids.season, n, i]);
  // The admin plays too: up to Episode 3 on the season, so What scores holds this season's moments past it.
  await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 3)", [ids.desk, ids.season]);
  const made = await ensureSeasonRulebook(pool, ids.season);
  if (!made) throw new Error("the season's rulebook wasn't made");
  ids.rulebook = made.row.id;
  // A library rulebook of its own (no season): our bot can't be asked about it.
  ids.library = (await one(
    `INSERT INTO rulebooks (name, kind, owner_kind, status, review_status, blocks, aliases, provenance, created_by)
     VALUES ('zt-rr-library', $1, 'library', 'in_force', 'approved', $2::jsonb, '{}'::jsonb, '{"from":"test"}'::jsonb, $3) RETURNING id`,
    [made.row.kind, JSON.stringify(made.row.blocks), ids.desk]
  )).id;
  return ids;
}

const REAL = `SELECT (SELECT count(*)::int FROM rulebook_answers a JOIN rulebooks r ON r.id = a.rulebook_id LEFT JOIN show_seasons ss ON ss.id = r.season_id LEFT JOIN shows s ON s.id = ss.show_id WHERE COALESCE(s.slug, '') NOT LIKE 'zt-%' AND r.name <> 'zt-rr-library') AS answers,
  (SELECT count(*)::int FROM desk_runs d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%') AS runs`;

/** A What scores answer: every moment on `rung` (`except` by id), plus `add`. */
const scoresAnswer = (blocks, rung, { except = {}, add = [] } = {}) =>
  "```json\n" + JSON.stringify({ schema: 1, scores: Object.fromEntries(momentsFor(blocks).map((m) => [m.id, { rung: except[m.id] ?? rung, rarity: "mostEpisodes", why: "the test says so" }])), add, leftOut: [] }) + "\n```";
/** A Check for changes answer: the rulebook as it is, plus a moment added by hand. */
const checkAnswer = (blocks) => {
  const b = JSON.parse(JSON.stringify(blocks));
  b.customMoments = [...(b.customMoments || []), { id: "gotInAFight", label: "Got in a fight", counted: "yesNo", answeredBy: "research", reliability: "usually" }];
  return "Here is the rulebook:\n```json\n" + JSON.stringify(b) + "\n```";
};

async function main() {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const real = (await pool.query(REAL)).rows[0];
  try {
    const ids = await up(pool);
    const bot = await fakeBot.start({ delayMs: 1500, answer: () => "{}" });
    closers.push(bot.close);
    const headers = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD, headers }), jo: await api({ user: U("jo"), pass: PASSWORD, headers }) };
    const P = `/api/desk/rulebooks/${ids.rulebook}`;
    const read = async (p = P) => (await as.desk.call("GET", p)).body;
    const post = (body, p = P) => as.desk.call("POST", p, body);
    const history = async () => (await pool.query("SELECT text FROM admin_changes WHERE entity = 'rulebook' AND entity_id = $1 ORDER BY created_at DESC", [ids.rulebook])).rows.map((r) => r.text);
    const until = async (test, ms = 30_000) => {
      const from = Date.now();
      for (;;) {
        const page = await read();
        if (test(page)) return page;
        if (Date.now() - from > ms) return page;
        await sleep(1000);
      }
    };

    // 1. Only site admins.
    check((await as.jo.call("GET", P)).status === 403, "jo is refused the rulebook page");
    check((await as.jo.call("GET", `${P}?prompt=scores`)).status === 403, "jo is refused its question");
    check((await as.jo.call("POST", P, { action: "ask", kind: "scores" })).status === 403, "jo is refused Ask our bot");
    check((await as.jo.call("POST", P, { action: "paste", kind: "scores", answer: "{}" })).status === 403, "jo is refused a paste");

    // 2. The read.
    let page = await read();
    check(page.research && page.research.bot === true && page.research.check.asking === null && page.research.scores.answer === null, "research offered: our bot, nothing asking, nothing waiting", JSON.stringify(page.research));
    const aired = page.season.aired;
    check(aired >= 4 && page.research.mark === 3 && page.research.through.suggested === 3 && page.research.through.max === 14, "the admin is up to Episode 3: the mark, and Check for changes suggests up to it, 14 at most", JSON.stringify({ mark: page.research.mark, through: page.research.through }));
    const moments = momentsFor(page.now);
    check(moments.length >= 8 && moments.some((m) => m.id === "eliminationWon"), "the fixture's rulebook is The Challenge's", moments.map((m) => m.id).join(","));
    const q = (await read(`${P}?prompt=scores`));
    check(moments.every((m) => q.prompt.includes(`"${m.id}": ${m.label}`)) && LADDER.every((r) => q.prompt.includes(`${r.id}: `)) && /first \d+ episodes/.test(q.prompt) && /scoring the moments of/.test(q.task), "What scores' question: every moment, the ladder, the season so far", q.prompt.slice(0, 200));
    const q1 = await read(`${P}?prompt=1`);
    const qc = await read(`${P}?prompt=check`);
    check(/as a rulebook for a fantasy game/.test(q1.prompt) && /Start from this rulebook/.test(q1.prompt) && q1.prompt.includes('"elimination"') && q1.prompt === qc.prompt && /describing how/.test(qc.task), "Check for changes' question: the rulebook prompt from this rulebook (?prompt=1 is ?prompt=check)");
    check((await as.desk.call("GET", `${P}?prompt=bingo`)).status === 400, "an unknown question refused");
    const play = (await as.desk.call("GET", `${P}?play=1`)).body;
    check(play.through === 0 && play.moments.length === 0 && /No results yet/.test(play.notes[0]), "how the scoring is playing: no results yet, nothing to read", JSON.stringify(play));
    check((await as.jo.call("GET", `${P}?play=1`)).status === 403, "jo is refused it");
    const q3 = await read(`${P}?prompt=scores&through=3`);
    check(!/have been watched/.test(q3.prompt) && q3.through === null && /its earlier seasons too/.test(q3.prompt) && /"known": "pastSeasons"/.test(q3.prompt) && /onceOrTwice: \+1/.test(q3.prompt), "What scores reads the whole season whatever's asked: earlier seasons, known from past seasons, rarity", q3.task);
    const qc3 = await read(`${P}?prompt=check&through=3`);
    check(/Only Episodes 1 to 3 of this season have been watched/.test(qc3.prompt) && /never add a segment, a twist, a way out or a phase that first appears after it/.test(qc3.prompt), "Check for changes up to Episode 3: only that far");
    check(/have been watched/.test((await read(`${P}?prompt=check&through=14`)).prompt), "Check for changes up to the last episode: scoped all the same");
    check((await as.desk.call("GET", `${P}?prompt=check&through=15`)).status === 400 && (await as.desk.call("GET", `${P}?prompt=check&through=0`)).status === 400, "past the last episode, or 0: refused");

    // 3. Paste on What scores.
    let r = await post({ action: "paste", kind: "scores", answer: "I couldn't find anything, sorry." });
    check(r.status === 400 && /no JSON object/.test(r.body.error), "a paste that isn't JSON refused", JSON.stringify(r.body));
    check((await post({ action: "paste", kind: "moon", answer: "{}" })).status === 400, "a paste of an unknown kind refused");
    const paste = scoresAnswer(page.now, "edge", {
      except: { eliminationWon: "wonAlone", quit: "ownFault", captain: "nothing" },
      add: [
        { id: "calledOut", label: "Called out an opponent", rung: "earned", rarity: "someEpisodes", why: "rare and telling", known: "pastSeasons", firstEpisode: 1, counted: "yesNo", answeredBy: "research", reliability: "usually", during: { segment: "elimination" } },
        { id: "openingTwist", label: "Won the opening twist", rung: "earned", rarity: "onceOrTwice", known: "thisSeason", firstEpisode: 2 },
        { id: "lateTwist", label: "Won the Redemption Arena", rung: "bigPlay", rarity: "onceOrTwice", known: "thisSeason", firstEpisode: 9 },
        { label: "Won the elimination", rung: "wonAlone" },
        { label: "Ava threw a drink", rung: "slip" },
      ],
    });
    r = await post({ action: "paste", kind: "scores", answer: paste });
    check(r.status === 200, "an answer pasted", JSON.stringify(r.body).slice(0, 200));
    page = r.body;
    const a = page.research.scores.answer;
    check(!!a && a.source === "paste" && a.by === U("desk") && a.kind === "scores" && a.through === null, "the answer waits on What scores, from the paste", JSON.stringify(a && { source: a.source, by: a.by, through: a.through }));
    check((await post({ action: "paste", kind: "check", answer: "{}", through: 40 })).status === 400, "a paste up to an episode the season hasn't got: refused");
    const row = (id) => (a.rows || []).find((x) => x.id === id);
    check(row("eliminationWon") && row("eliminationWon").before === 3 && row("eliminationWon").after === 4 && row("eliminationWon").rung === "wonAlone" && row("eliminationWon").changed, "Won the Elimination: 3 -> 4, wonAlone", JSON.stringify(row("eliminationWon")));
    check(row("quit") && row("quit").after === -3 && row("quit").changed, "Quit: -5 -> -3, ownFault", JSON.stringify(row("quit")));
    check(row("captain") && row("captain").drop === true && row("captain").changed && !a.blocks.customMoments.some((m) => m.id === "captain"), "Served as team captain, added by hand and worth nothing: dropped", JSON.stringify(row("captain")));
    check(a.added.length === 2 && a.added[0].id === "calledOut" && a.added[0].points === 2.5 && a.added[0].rarity === "someEpisodes" && a.added[1].id === "openingTwist" && a.added[1].points === 3, "Called out an opponent added at 2.5 (earned, some episodes); the opening twist at 3, reached", JSON.stringify(a.added));
    const shown = JSON.stringify(page);
    check(!shown.includes("Redemption") && !shown.includes("lateTwist"), "the Redemption Arena, from Episode 9: held, with no trace of it on the page");
    check(a.skipped.length === 2 && /has it: Won the Elimination/.test(a.skipped[0].why) && /names Ava/.test(a.skipped[1].why), "a repeat and a name left out", JSON.stringify(a.skipped));
    check(/moments rescored · 1 moment dropped · 2 moments added/.test(a.title) && a.blocks && a.blocks.points.eliminationWon === 4 && a.blocks.customMoments.some((m) => m.id === "calledOut") && !a.blocks.customMoments.some((m) => m.id === "lateTwist") && a.problems.length === 0 && a.changes >= 2, "its title, and the blocks to draft from (nothing held in them)", a.title);
    check(/What scores, a pasted answer: .*rescored · 1 moment dropped · 2 moments added/.test((await history())[0]), "History says so, counting what's shown", (await history())[0]);
    // The same question again reads the same, with the answer still waiting.
    check((await read()).research.scores.answer.id === a.id, "the answer is still there on the next read");
    // Check for changes takes a paste beside it.
    r = await post({ action: "paste", kind: "check", answer: checkAnswer(page.now) });
    const c = r.body.research && r.body.research.check.answer;
    check(r.status === 200 && c && c.kind === "check" && /1 change from the rulebook now/.test(c.title) && c.lines.some((l) => /Got in a fight/.test(l)) && c.blocks, "Check for changes: a paste staged beside it, 1 change (Got in a fight)", JSON.stringify(r.body.research && r.body.research.check));
    check(r.body.research.scores.answer.id === a.id, "What scores' answer is untouched by it");

    // 4. Settled.
    const visible = [...a.rows.filter((x) => x.changed).map((x) => x.id), ...a.added.map((x) => x.id)];
    r = await post({ action: "answer", answer: a.id, status: "used", ids: visible.filter((x) => x !== "openingTwist"), declined: ["openingTwist"] });
    check(r.status === 200 && r.body.research.scores.answer === null && r.body.research.check.answer.id === c.id, "Use: the rows shown settled, nothing left to see, Check for changes' still waiting", JSON.stringify(r.body.research && r.body.research.scores));
    const { rows: openRow } = await pool.query("SELECT settled_at, settled FROM rulebook_answers WHERE id = $1", [a.id]);
    check(openRow[0].settled_at === null && openRow[0].settled.calledOut === "used" && openRow[0].settled.openingTwist === "dismissed" && openRow[0].settled.lateTwist === undefined, "the answer stays open: the held moment waits, unseen", JSON.stringify(openRow[0]));
    // Past Episode 9: it shows, on its own, and settles the answer.
    await pool.query("UPDATE show_follows SET seen_through = 9 WHERE user_id = $1 AND season_id = $2", [ids.desk, ids.season]);
    page = await read();
    const later = page.research.scores.answer;
    check(page.research.mark === 9 && !!later && later.id === a.id && later.added.length === 1 && later.added[0].id === "lateTwist" && later.added[0].points === 4 && /^1 moment added$/.test(later.title), "up to Episode 9: the Redemption Arena shows, 1 moment added, nothing settled comes back", JSON.stringify(later && { title: later.title, added: later.added.map((m) => m.id), rows: later.rows.filter((x) => x.changed).length }));
    r = await post({ action: "answer", answer: a.id, status: "used", ids: ["lateTwist"], declined: [] });
    const doneRow = (await pool.query("SELECT settled_at, settled FROM rulebook_answers WHERE id = $1", [a.id])).rows[0];
    check(r.status === 200 && r.body.research.scores.answer === null && doneRow.settled_at !== null, "settled: nothing left, the answer is done", JSON.stringify({ status: r.status, answer: r.body.research && r.body.research.scores.answer && { title: r.body.research.scores.answer.title, rows: r.body.research.scores.answer.rows.filter((x) => x.changed).map((x) => x.id), added: r.body.research.scores.answer.added.map((x) => x.id) }, doneRow }));
    await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [ids.desk, ids.season]);
    check((await post({ action: "answer", answer: a.id, status: "used" })).status === 404, "settled twice refused");
    check((await post({ action: "answer", answer: c.id, status: "burned" })).status === 400, "an unknown settlement refused");
    r = await post({ action: "answer", answer: c.id, status: "dismissed" });
    check(r.status === 200 && r.body.research.check.answer === null, "Put away: Check for changes' answer settled");
    const { rows: settled } = await pool.query("SELECT settled_as FROM rulebook_answers WHERE rulebook_id = $1 ORDER BY created_at", [ids.rulebook]);
    check(settled.map((s) => s.settled_as).join(",") === "used,dismissed", "the answers are kept as used and dismissed", JSON.stringify(settled));

    // 5. Ask our bot.
    bot.answer = (prompt, kind) => {
      if (kind === "scores") return scoresAnswer(page.now, "along", { except: { winner: "wonSeason" } });
      if (kind === "setup") return checkAnswer(page.now);
      throw new Error(`not asked here: ${kind}`);
    };
    r = await post({ action: "ask", kind: "scores" });
    check(r.status === 200 && /Asking ChatGPT: What scores on/.test(r.body.text), "What scores asked of our bot", JSON.stringify(r.body));
    page = await read();
    check(!!page.research.scores.asking && /Asking our bot now|Waiting to ask/.test(page.research.scores.asking), "the page says it's asking", JSON.stringify(page.research.scores));
    check((await post({ action: "ask", kind: "scores" })).body.text.startsWith("Already asking"), "asked again meanwhile: joins the first");
    page = await until((p) => !!p.research.scores.answer);
    const b1 = page.research.scores.answer;
    check(!!b1 && b1.source === "bot" && page.research.scores.asking === null, "its answer landed, from our bot", JSON.stringify(page.research.scores));
    check(bot.asked.some((x) => x.kind === "scores") && !bot.asked.some((x) => x.kind === "setup"), "the stand-in got the What scores question", bot.asked.map((x) => x.kind).join(","));
    check(b1 && (b1.rows || []).find((x) => x.id === "winner").after === 6 && /moments rescored/.test(b1.title), "winner: wonSeason, 6", b1 && b1.title);
    const { rows: runs } = await pool.query("SELECT kind, ok, rulebook_id FROM desk_runs WHERE season_id = $1 ORDER BY asked_at", [ids.season]);
    check(runs.length === 1 && runs[0].kind === "scores" && runs[0].ok === true && runs[0].rulebook_id === ids.rulebook, "one desk run, kind scores, on the rulebook, ok", JSON.stringify(runs));
    check(/What scores, our bot's answer/.test((await history())[0]), "History: our bot's answer", (await history())[0]);
    // Check for changes through the bot.
    r = await post({ action: "ask", kind: "check" });
    check(r.status === 200 && /Check for changes on/.test(r.body.text), "Check for changes asked of our bot", JSON.stringify(r.body));
    page = await until((p) => !!p.research.check.answer);
    const b2 = page.research.check.answer;
    check(!!b2 && b2.source === "bot" && /1 change/.test(b2.title) && bot.asked.some((x) => x.kind === "setup" && x.prompt.includes('"elimination"')), "its answer landed: the rulebook question with this rulebook as its template, 1 change", JSON.stringify(page.research.check));
    check(page.research.scores.answer && page.research.scores.answer.id === b1.id, "What scores' answer still waits beside it");
    // The bot down, and a rulebook with no season.
    bot.down = true;
    r = await post({ action: "answer", answer: b2.id, status: "dismissed" });
    r = await post({ action: "ask", kind: "check" });
    check(r.status === 503 && /isn't answering/.test(r.body.error), "the bot down: refused, nothing queued", JSON.stringify(r.body));
    bot.down = false;
    r = await post({ action: "ask", kind: "scores" }, `/api/desk/rulebooks/${ids.library}`);
    check(r.status === 400 && /season's rulebook/.test(r.body.error), "a library rulebook: our bot can't be asked, paste instead", JSON.stringify(r.body));
    check((await read(`/api/desk/rulebooks/${ids.library}`)).research.bot === false, "and its page says so");
    // A bot answer that can't be read: a failed run, History says so, nothing staged.
    bot.answer = () => "Sorry, I can't help with that.";
    await post({ action: "answer", answer: b1.id, status: "dismissed" });
    r = await post({ action: "ask", kind: "scores" });
    await until((p) => !p.research.scores.asking);
    const { rows: runs2 } = await pool.query("SELECT ok, message FROM desk_runs WHERE season_id = $1 ORDER BY asked_at DESC LIMIT 1", [ids.season]);
    check(runs2[0].ok === false && /no JSON object/.test(runs2[0].message) && (await read()).research.scores.answer === null && /it failed/.test((await history())[0]), "an answer it can't read: a failed run, History says so, nothing staged", JSON.stringify(runs2[0]));

    // Check for changes asked up to Episode 3: the run's episode, the question's scope, the answer's card.
    bot.answer = (prompt, kind) => {
      if (kind === "setup") return checkAnswer(page.now);
      throw new Error(`not asked here: ${kind}`);
    };
    r = await post({ action: "ask", kind: "check", through: 3 });
    check(r.status === 200 && /Check for changes on .* up to Episode 3/.test(r.body.text), "Check for changes up to Episode 3 asked of our bot", JSON.stringify(r.body));
    page = await until((p) => !!p.research.check.answer);
    const b3 = page.research.check.answer;
    const { rows: run3 } = await pool.query("SELECT episode_number FROM desk_runs WHERE season_id = $1 AND kind = 'rulebook' ORDER BY asked_at DESC LIMIT 1", [ids.season]);
    const asked3 = bot.asked[bot.asked.length - 1];
    check(!!b3 && b3.through === 3 && run3[0].episode_number === 3 && asked3.kind === "setup" && /Only Episodes 1 to 3/.test(asked3.prompt), "its run is Episode 3's, the question reads only that far, the card says so", JSON.stringify({ through: b3 && b3.through, run: run3[0] }));
    check((await post({ action: "ask", kind: "check", through: 99 })).status === 400, "asked past the last episode: refused");
    await post({ action: "answer", answer: b3.id, status: "dismissed" });

    // 6. In the browser.
    bot.answer = (prompt, kind) => {
      // Everything on edge (1) but the elimination (4) and medically removed (nothing: as it is), plus one added: 8 moments change.
      if (kind === "scores") return scoresAnswer(page.now, "edge", { except: { eliminationWon: "wonAlone", medicallyRemoved: "nothing" }, add: [{ id: "calledOut", label: "Called out an opponent", rung: "earned", rarity: "someEpisodes", why: "rare", known: "pastSeasons", counted: "yesNo", answeredBy: "research", reliability: "usually" }] });
      throw new Error(`not asked here: ${kind}`);
    };
    const { page: web, errors, close } = await open({ user: U("desk"), pass: PASSWORD, width, headers });
    closers.push(close);
    const shot = (name) => web.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
    const noWider = async (what) => {
      const w = await web.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      check(w <= width, `${what}: nothing wider than the screen`, `${w} > ${width}`);
    };
    await web.goto(`${BASE}/desk/rulebook/${ids.rulebook}`, { waitUntil: "networkidle" });
    await web.locator('[data-desk-row="research-scores"]').waitFor({ timeout: 30_000 });
    check((await web.locator('[data-desk-row="research-check"]').count()) === 1 && (await web.locator('[data-desk-row="research-play"]').count()) === 1 && (await web.locator('[data-check-changes]').count()) === 0, "the Research rows, no copy-only button");
    await web.locator('[data-desk-row="research-scores"]').scrollIntoViewIfNeeded();
    await shot("1-rulebook");
    await noWider("the rulebook page");
    await web.locator('[data-desk-row="research-scores"]').click();
    await web.locator('[data-research-sheet="scores"] [data-research-ask]').waitFor({ timeout: 10_000 });
    check((await web.locator('[data-research-sheet="scores"] [data-question="through"]').count()) === 0 && /after Episode 3, where you are, shows up here as you get there/.test(await web.locator("[data-research-held-line]").innerText()), "What scores: no episode to pick, the whole season, and the fixed line", await web.locator("[data-research-held-line]").innerText());
    await shot("2-what-scores");
    await web.locator('[data-research-ask]').click();
    await web.locator('[data-research-asking]').waitFor({ timeout: 10_000 });
    await shot("3-asking");
    await web.locator('[data-research-answer]').waitFor({ timeout: 30_000 });
    check((await web.locator('[data-score-row="eliminationWon"]').count()) === 1 && (await web.locator('[data-score-added="calledOut"]').count()) === 1, "the answer's card lands in the open sheet: the rescored row and the added moment");
    check((await web.locator("[data-research-answer]").getAttribute("data-research-through")) === "all", "the card is the whole season's");
    check(/won alone · most episodes/.test(await web.locator('[data-score-row="eliminationWon"]').innerText()) && /earned · some episodes/.test(await web.locator('[data-score-added="calledOut"]').innerText()), "the rung and rarity in words", await web.locator('[data-score-row="eliminationWon"]').innerText());
    // The pick list: added first, then every moment; a row that changes nothing has no pick; Use counts what's accepted.
    const order = await web.locator("[data-score-picks] [data-score-added], [data-score-picks] [data-score-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-score-added") || e.getAttribute("data-score-row")));
    check(order[0] === "calledOut" && order.length === 1 + moments.length, "added moments first, then every moment", order.join(","));
    check((await web.locator('[data-score-row="medicallyRemoved"][data-same]').count()) === 1 && (await web.locator('[data-score-row="medicallyRemoved"] [data-pick]').count()) === 0, "a moment left as it is has nothing to pick");
    check((await web.locator("[data-pick][data-on]").count()) === 9 && /Use 9 changes/.test(await web.locator("[data-research-use]").innerText()), "every change accepted to start: Use 9 changes", await web.locator("[data-research-use]").innerText());
    await web.locator('[data-pick="calledOut"]').click();
    await web.locator('[data-pick="eliminated"]').click();
    check((await web.locator('[data-score-added="calledOut"][data-declined]').count()) === 1 && /Use 7 changes/.test(await web.locator("[data-research-use]").innerText()), "two declined: Use 7 changes", await web.locator("[data-research-use]").innerText());
    await shot("4-answer");
    await noWider("the answer's sheet");
    await web.locator('[data-research-use]').click();
    await web.locator('[data-unsaved]').waitFor({ timeout: 10_000 });
    await web.locator('[data-desk-row="research-scores"] [data-off]').waitFor({ state: "detached", timeout: 10_000 });
    check((await web.locator('[data-research-sheet]').count()) === 0 && (await web.locator('[data-desk-row="research-scores"] [data-off]').count()) === 0, "Use 7 changes: the sheet closes, the draft has its changes, the row's dot is gone");
    // The draft's footer counts edits (every point change is one), so the seven picked read as one line of seven moments.
    const unsaved = await web.locator("[data-unsaved]").innerText();
    check(/Suggested points: 7 moments/.test(unsaved) && !/New moment/.test(unsaved), "the draft has the 7 picked points, not the declined one or the declined addition", unsaved);
    await shot("5-draft");
    await web.locator('[data-discard]').click();
    await web.locator('[data-unsaved]').waitFor({ state: "detached", timeout: 10_000 });
    await web.locator('[data-desk-row="research-check"]').click();
    await web.locator('[data-research-sheet="check"] [data-research-paste]').waitFor({ timeout: 10_000 });
    check((await web.locator('[data-research-sheet="check"] [data-question="through"] [data-value]').innerText()).trim() === "3", "Check for changes: Up to episode, suggested from where the admin is");
    await web.locator('[data-research-paste]').click();
    await web.locator('[data-ask-ai="rulebook-check"]').waitFor({ timeout: 10_000 });
    check((await web.locator('[data-ask-ai="rulebook-check"] [data-ai-open="chatgpt"]').count()) === 1, "Paste it: Ask an AI's sheet, Open in ChatGPT");
    await shot("6-paste");
    await noWider("Ask an AI's sheet");
    await web.keyboard.press("Escape");
    await web.locator('[data-ask-ai="rulebook-check"]').waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
    await web.keyboard.press("Escape");
    await web.locator('[data-research-sheet]').waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
    await web.locator('[data-desk-row="research-play"]').click();
    await web.locator("[data-play-sheet] [data-play-notes]").waitFor({ timeout: 10_000 });
    check(/No results yet/.test(await web.locator("[data-play-notes]").innerText()), "How the scoring is playing: its sheet, read-only");
    await shot("7-play");
    check(errors.length === 0, "no page errors", errors.join(" | "));

    // 7. Nothing real moved.
    const after = (await pool.query(REAL)).rows[0];
    check(after.answers === real.answers && after.runs === real.runs, "nothing real moved", JSON.stringify({ real, after }));
  } finally {
    for (const c of closers.reverse()) await c().catch(() => undefined);
    if (!keep) await down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
