// Dev-only check for What scores on a couch's own copy (docs/PLAN-rulebook-research.md, stage two; src/lib/server/our-scores.ts),
// against the dev server, on new-fixture.js: couch A ("ZT Survivor 51": alex runs its three games, riley is a Game admin,
// jordan plays) on one zt Survivor 51. The ask-AI bot is the stand-in (fake-bot.js, through the dev-only x-gys-bot header).
//   1. Without a copy: the state says so, and Ask our bot is refused (Make it ours first). Riley can't change the rules;
//      jordan has no Scoring rules at all.
//   2. Make it ours (alex, the API); alex up to Episode 3: the state's mark; the question lists the copy's moments.
//   3. Paste: an answer staged (moments rescored with their rungs and rarity, two added, a new-this-season moment from
//      Episode 9 held with no trace of it on the page); the rows' line.
//   4. Settle: the preview says what moves; Accept, Adjust and Decline: the copy's points move for the accepted and the
//      adjusted, not the declined; the added moment is the couch's to answer; one batch in Recent changes; Undo puts the
//      copy back. The answer stays open for the held moment (nothing to see); past Episode 9 it shows; Put away ends it.
//   5. Ask our bot: queued, asked (the stand-in gets the scores question), its answer lands; put away.
//   6. In the browser at --width, as alex: the What scores row under What counts, the sheet (Ask our bot, Paste it, the
//      fixed line), an answer's rows with Accept · Adjust · Decline, Adjust's stepper, Save's preview. Nothing wider than
//      the screen; no page errors.
//   7. Nothing real moved.
// Screenshots go to <outDir>.
//
//   npm run dev                                              (in another terminal)
//   node scripts/dev-test/check-new-our-scores.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only. Refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fakeBot = require("./fake-bot");
const fixture = require("./new-fixture");
const { momentsFor } = require("../../src/lib/game/formats/rulebook-moments.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-our-scores runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
if (!out) throw new Error("usage: check-new-our-scores.js <outDir> [--width=390] [--keep]");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REAL = "SELECT count(*)::int AS n FROM rulebook_answers a JOIN rulebooks r ON r.id = a.rulebook_id LEFT JOIN leagues l ON l.id = r.league_id WHERE COALESCE(l.slug, '') NOT LIKE 'zt%' AND r.season_id IS NULL";

/** A What scores answer: every moment of `blocks` on `rung` (`except` by id), plus `add`. */
const scoresAnswer = (blocks, rung, { except = {}, add = [] } = {}) =>
  "```json\n" + JSON.stringify({ schema: 1, scores: Object.fromEntries(momentsFor(blocks).map((m) => [m.id, { rung: except[m.id] ?? rung, rarity: "mostEpisodes", why: "the test says so" }])), add, leftOut: [] }) + "\n```";

async function main() {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const realBefore = (await pool.query(REAL)).rows[0].n;
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const A = `?couch=${fx.couchId}`;
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const bot = await fakeBot.start({ delayMs: 1500, answer: () => "{}" });
    closers.push(bot.close);
    const headers = { "x-gys-bot": bot.url };
    const as = {};
    for (const who of ["alex", "riley", "jordan"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD, headers });
    const P = `/api/seasons/${sid}/backstage/rules/scores${A}`;
    const state = async (who = "alex") => (await as[who].call("GET", P)).body;
    const post = (body, who = "alex") => as[who].call("POST", P, body);
    const copyRow = async () => (await pool.query("SELECT r.id, r.blocks, r.version FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id = $1", [fx.leagues.lineup])).rows[0];
    const until = async (test, ms = 30_000) => {
      const from = Date.now();
      for (;;) {
        const s = await state();
        if (test(s)) return s;
        if (Date.now() - from > ms) return s;
        await sleep(1000);
      }
    };

    // 1. Without a copy.
    let s = await state();
    check(s.copy === false && s.canChange === true && s.answer === null, "no copy yet: the state says so", JSON.stringify(s));
    let r = await post({ action: "ask" });
    check(r.status === 409 && /Make it ours first/.test(r.body.error), "Ask our bot without a copy: Make it ours first", JSON.stringify(r.body));
    check((await state("riley")).canChange === false && (await post({ action: "paste", answer: "{}" }, "riley")).status === 403, "riley (a Game admin) can't change the rules");
    check((await as.jordan.call("GET", P)).status === 403, "jordan (a player) has no Scoring rules");

    // 2. Make it ours; alex up to Episode 3.
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/rules${A}`, { action: "ours" });
    check(r.status === 200 && r.body.games === 3, "Make it ours: one copy for couch A's three games", JSON.stringify(r.body));
    await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = 3", [fx.users.alex, sid]);
    await pool.query("UPDATE user_settings SET show_results_immediately = false WHERE user_id = $1", [fx.users.alex]);
    s = await state();
    check(s.copy === true && s.mark === 3 && s.asking === null && s.answer === null, "a copy, alex up to Episode 3, nothing asking or waiting", JSON.stringify(s));
    const copy = await copyRow();
    const moments = momentsFor(copy.blocks);
    const q = (await as.alex.call("GET", `${P}&prompt=1`)).body;
    check(moments.length > 10 && moments.every((m) => q.prompt.includes(`"${m.id}": ${m.label}`)) && /scoring the moments of/.test(q.task), "the question lists the copy's moments", q.task);

    // 3. Paste.
    const changeA = moments.find((m) => typeof m.defaultPoints === "number" && m.defaultPoints !== 4 && m.defaultPoints !== 1 && m.defaultPoints > 0);
    const changeB = moments.find((m) => m !== changeA && typeof m.defaultPoints === "number" && m.defaultPoints !== 1 && m.defaultPoints !== 4 && m.defaultPoints > 0);
    const same = moments.filter((m) => m.defaultPoints === 1).map((m) => m.id);
    const except = Object.fromEntries(moments.map((m) => [m.id, "edge"]));
    except[changeA.id] = "wonAlone";
    except[changeB.id] = "wonAlone";
    const paste = scoresAnswer(copy.blocks, "edge", {
      except,
      add: [
        { id: "calledOut", label: "Called out an opponent at camp", rung: "earned", rarity: "someEpisodes", why: "rare and telling", known: "pastSeasons", firstEpisode: 1, counted: "yesNo", answeredBy: "research", reliability: "usually" },
        { id: "openingTwist", label: "Won the opening twist", rung: "earned", rarity: "onceOrTwice", known: "thisSeason", firstEpisode: 2 },
        { id: "lateTwist", label: "Won the Redemption Arena", rung: "bigPlay", rarity: "onceOrTwice", known: "thisSeason", firstEpisode: 9 },
      ],
    });
    r = await post({ action: "paste", answer: paste });
    check(r.status === 200 && r.body.answer && r.body.answer.source === "paste", "an answer pasted and staged", JSON.stringify(r.body).slice(0, 200));
    s = r.body;
    const a = s.answer;
    const row = (id) => a.rows.find((x) => x.id === id);
    check(row(changeA.id).changed && row(changeA.id).after === 4 && row(changeA.id).rung === "wonAlone" && same.every((id) => !row(id).changed), `${changeA.label}: ${changeA.defaultPoints} -> 4, won alone; what's already 1 stays`, JSON.stringify(row(changeA.id)));
    check(a.added.length === 2 && a.added[0].id === "calledOut" && a.added[0].points === 2.5 && a.added[1].id === "openingTwist" && a.added[1].points === 3, "two added: Called out (2.5, earned, some episodes) and the opening twist (3)", JSON.stringify(a.added.map((m) => [m.id, m.points])));
    const shown = JSON.stringify(s);
    check(!shown.includes("Redemption") && !shown.includes("lateTwist"), "the Redemption Arena, from Episode 9: held, with no trace of it");
    check(/moments rescored · 2 moments added/.test(a.title), "its title counts what's shown", a.title);

    // 4. Settle: preview, then Accept, Adjust, Decline; Undo; the held moment later; Put away.
    const accept = { [changeA.id]: 4, calledOut: 1.5 };
    const declined = [changeB.id, "openingTwist"];
    r = await post({ action: "settle", answer: a.id, accept, declined, preview: true });
    check(r.status === 200 && Array.isArray(r.body.lines), "the preview says what moves", JSON.stringify(r.body).slice(0, 200));
    const before = await copyRow();
    // A row named in neither accept nor declined is accepted at the ladder's value (Accept is the default).
    const decidable = a.rows.filter((x) => x.changed).length + a.added.length;
    r = await post({ action: "settle", answer: a.id, accept, declined });
    check(r.status === 200 && r.body.batch && r.body.saved === decidable - 2 && r.body.declined === 2, `settled: ${decidable - 2} saved (the rest accepted as the ladder says), 2 declined, one batch`, JSON.stringify(r.body));
    const batch = r.body.batch;
    let after = await copyRow();
    const custom = (after.blocks.customMoments || []).find((m) => m.id === "calledOut");
    check(after.version === before.version + 1 && after.blocks.points[changeA.id] === 4 && after.blocks.points.calledOut === 1.5 && (after.blocks.points[changeB.id] ?? null) === (before.blocks.points[changeB.id] ?? null), "the copy: accepted at 4, adjusted to 1.5, the declined one as it was", JSON.stringify({ a: after.blocks.points[changeA.id], c: after.blocks.points.calledOut, b: after.blocks.points[changeB.id] }));
    check(!!custom && custom.answeredBy === "league" && custom.reliability === undefined && !(after.blocks.customMoments || []).some((m) => m.id === "openingTwist"), "the added moment is the couch's to answer; the declined one isn't added", JSON.stringify(custom));
    const { rows: changes } = await pool.query("SELECT text FROM league_changes WHERE batch = $1", [batch]).catch(() => ({ rows: [] }));
    check(changes.length === 3 && changes.every((c) => new RegExp(`What scores: ${decidable - 3} moments rescored, 1 moment added, the couch answers`).test(c.text)), "Recent changes says what it did, in each game", JSON.stringify(changes.map((c) => c.text)));
    const { rows: openRows } = await pool.query("SELECT settled_at, settled FROM rulebook_answers WHERE id = $1", [a.id]);
    check(openRows[0].settled_at === null && openRows[0].settled[changeA.id] === "used" && openRows[0].settled[changeB.id] === "dismissed" && openRows[0].settled.lateTwist === undefined, "the answer stays open for the held moment, unseen", JSON.stringify(openRows[0]));
    s = await state();
    check(s.answer === null, "nothing left to see: no answer on the row");
    r = await as.alex.call("POST", `/api/seasons/${sid}/changes/${encodeURIComponent(batch)}/undo${A}`);
    after = await copyRow();
    check(r.status === 200 && (after.blocks.points[changeA.id] ?? null) === (before.blocks.points[changeA.id] ?? null) && !(after.blocks.customMoments || []).some((m) => m.id === "calledOut"), "Undo puts the copy back", JSON.stringify(r.body).slice(0, 160));
    await pool.query("UPDATE show_follows SET seen_through = 9 WHERE user_id = $1 AND season_id = $2", [fx.users.alex, sid]);
    s = await state();
    check(s.mark === 9 && s.answer && s.answer.id === a.id && s.answer.added.length === 1 && s.answer.added[0].id === "lateTwist" && /^1 moment added$/.test(s.answer.title), "up to Episode 9: the Redemption Arena shows, on its own", JSON.stringify(s.answer && { title: s.answer.title, added: s.answer.added.map((m) => m.id) }));
    r = await post({ action: "putAway", answer: a.id });
    check(r.status === 200 && r.body.answer === null && (await pool.query("SELECT settled_at FROM rulebook_answers WHERE id = $1", [a.id])).rows[0].settled_at !== null, "Put away: the answer is done");
    await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [fx.users.alex, sid]);

    // 5. Ask our bot.
    bot.answer = (prompt, kind) => {
      if (kind === "scores") return scoresAnswer(copy.blocks, "along", { add: [{ id: "calledOut", label: "Called out an opponent at camp", rung: "earned", rarity: "someEpisodes", known: "pastSeasons", counted: "yesNo", answeredBy: "research", reliability: "usually" }] });
      throw new Error(`not asked here: ${kind}`);
    };
    r = await post({ action: "ask" });
    check(r.status === 200 && /Asking ChatGPT: What scores on/.test(r.body.text), "What scores asked of our bot", JSON.stringify(r.body));
    s = await state();
    check(!!s.asking, "the state says it's asking", JSON.stringify(s));
    s = await until((x) => !!x.answer);
    check(s.answer && s.answer.source === "bot" && s.asking === null && bot.asked.some((x) => x.kind === "scores"), "its answer landed, from our bot", JSON.stringify(s).slice(0, 200));
    const { rows: runs } = await pool.query("SELECT kind, ok, rulebook_id FROM desk_runs WHERE rulebook_id = $1", [copy.id]);
    check(runs.length === 1 && runs[0].kind === "scores" && runs[0].ok === true, "one desk run on the copy, ok", JSON.stringify(runs));
    const botAnswer = s.answer;

    // 6. In the browser, as alex.
    const web = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, headers });
    closers.push(web.close);
    const pg = web.page;
    const shot = (name) => pg.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
    const noWider = async (what) => {
      const w = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      check(w <= width, `${what}: nothing wider than the screen`, `${w} > ${width}`);
    };
    await pg.goto(`${web.BASE}/show/${sid}/backstage/rules`);
    await pg.locator("[data-our-scores]").waitFor({ timeout: 30_000 });
    check((await pg.locator("[data-our-scores] [data-scores-dot]").count()) === 1, "the What scores row under What counts, with its dot");
    await pg.locator("[data-our-scores]").scrollIntoViewIfNeeded();
    await shot("1-rules");
    await pg.locator("[data-our-scores]").click();
    await pg.locator("[data-our-scores-answer]").waitFor({ timeout: 10_000 });
    const n = await pg.locator("[data-our-row], [data-our-added]").count();
    check(n === botAnswer.rows.filter((x) => x.changed).length + botAnswer.added.length && (await pg.locator('[data-choice-made="accept"]').count()) === n, "every row shown, accepted to start");
    await shot("2-answer");
    await noWider("the answer");
    await pg.locator('[data-our-added="calledOut"] [data-choice="adjust"]').click();
    const more = pg.locator('[data-our-added="calledOut"] button[aria-label="More"]');
    await more.waitFor({ timeout: 5_000 });
    await more.click();
    check(/\+3/.test(await pg.locator('[data-our-added="calledOut"]').innerText()), "Adjust: a stepper, up half a point at a time", (await pg.locator('[data-our-added="calledOut"]').innerText()).replace(/\s+/g, " "));
    const firstRow = botAnswer.rows.find((x) => x.changed).id;
    await pg.locator(`[data-our-row="${firstRow}"] [data-choice="decline"]`).click();
    check((await pg.locator(`[data-our-row="${firstRow}"][data-choice-made="decline"]`).count()) === 1 && new RegExp(`Save ${n - 1}`).test(await pg.locator("[data-our-scores-save]").innerText()), "Decline one: Save counts the rest", await pg.locator("[data-our-scores-save]").innerText());
    await shot("3-choices");
    await pg.locator("[data-our-scores-save]").click();
    await pg.locator("[data-guard-confirm]").waitFor({ timeout: 15_000 });
    check((await pg.getByText("Score it this way?").count()) >= 1 && /Save/.test(await pg.locator("[data-guard-confirm]").innerText()), "Save: the preview guard says what moves first", await pg.locator("[data-guard-confirm]").innerText());
    await shot("4-preview");
    check(web.errors.length === 0, "no page errors", web.errors.join(" | "));

    // 7. Nothing real moved.
    check((await pool.query(REAL)).rows[0].n === realBefore, "nothing real moved");
  } finally {
    for (const c of closers.reverse()) await c().catch(() => undefined);
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
