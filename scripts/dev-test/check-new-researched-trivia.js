// Dev-only check for researched trivia (db/trivia-research.js, the 'trivia' bot run in db/bot-research.js, src/lib/server/trivia.ts),
// on new-fixture.js's couch (ZT Survivor 51: alex, riley, jordan and sam, results through Episode 5, everyone on 5 but sam on 3).
//   The run, with a stand-in bot (no ChatGPT): bot research's trivia job for Episodes 3 and 5 writes six questions each, one the
//   parse drops and one the check drops; what's stored (live and dropped, with why), and the prompts it sent (the cast with who
//   left when; the check listing every question).
//   API: alex's round is Episode 5's batch (3 researched questions, played once, whatever the week); sam (on 3) gets nothing
//   about Episodes 4 or 5, and Episode 3's batch, older than a week, in the week's round; alex's play is kept with its round, and
//   riley sees his score; "Wrong?" hides a question from whoever flags it, and from everyone at two flags; a computed question
//   can't be flagged; once Episode 5's batch is a week old, alex's week round never asks what he's already answered.
//   In a real browser at --width (390 by default): riley plays the round from the Games tab: a researched question's line on
//   what happened and its source after answering, Next, "Wrong?", the score. Nothing wider than the screen; no page errors.
//
//   node scripts/dev-test/check-new-researched-trivia.js <outDir> [--width=390] [--keep] [--api]
//
// Needs `npm run dev` (not for --api's run half, which calls runJob directly). Brings new-fixture.js up and down (--keep leaves
// it); its trivia rows go with its season. Touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const Bot = require("../../db/bot-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-researched-trivia runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-researched-trivia.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const u = fixture.username;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** A stand-in bot: six questions after episode n (one the parse drops), then the check (failing the fourth). */
function standIn(n, cast, sent) {
  const people = cast.slice(0, 4);
  const q = (episode, question, extra = {}) => ({ episode, question, options: people, answer: people[1], why: `${people[1]} did, in episode ${episode}.`, source: "https://example.com/recap", ...extra });
  const questions = [
    q(n, `Who found the clue in the well in episode ${n}?`),
    q(n, `Who sat out the challenge in episode ${n}?`),
    q(n, `How many votes were cast at Tribal Council in episode ${n}?`, { options: ["7", "5", "6", "8"], answer: "6", why: "Six votes were cast." }),
    q(n - 1, `What was the reward in episode ${n - 1}?`, { options: ["Pizza", "Tacos", "Burgers", "Letters"], answer: "Tacos", why: null }),
    q(1, `Who spoke first at the first Tribal Council (asked after ${n})?`),
    q(n + 1, "A question about an episode that hasn't aired"),
  ];
  return async (prompt) => {
    sent.push(prompt);
    if (/Someone else wrote them/.test(prompt)) {
      const checks = [1, 2, 3, 4, 5].map((i) => ({ n: i, correct: i !== 4, onlyOne: true, spoilerFree: true, note: i === 4 ? "It was burgers" : "" }));
      return { answer: "```json\n" + JSON.stringify({ checks }) + "\n```" };
    }
    return { answer: "Here you go.\n```json\n" + JSON.stringify({ found: true, questions }) + "\n```" };
  };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const A = fx.couchId;
    const U = fx.users;
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
    await pool.query("DELETE FROM trivia_plays WHERE user_id = ANY($1::text[])", [Object.values(U)]);
    const cast = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [sid])).rows.map((r) => r.name);

    // ---------- the run, with a stand-in bot ----------
    const season = await Bot.loadSeasonForJob(pool, sid);
    for (const n of [3, 5]) {
      const sent = [];
      const ran = await Bot.runJob(pool, { season, episode: n, kind: "trivia" }, { ask: standIn(n, cast, sent) });
      check(ran.ok && /^4 of 6 trivia question\(s\) passed their checks$/.test(ran.message), `Episode ${n}'s trivia run: 4 of 6 pass`, ran.message);
      check(sent.length === 2 && /Episode \d+ is the latest to air/.test(sent[0]) && /\(left in episode \d\)/.test(sent[0]) && /1\. \[Episode/.test(sent[1]), "two asks: the questions (the cast with who left when), then the check listing them", sent.map((s) => s.slice(0, 80)).join(" / "));
      const stored = (await pool.query("SELECT status, note, episode FROM trivia_questions WHERE season_id = $1 AND made_after = $2 ORDER BY created_at, question", [sid, n])).rows;
      check(stored.length === 5 && stored.filter((s) => s.status === "live").length === 4 && stored.some((s) => s.status === "dropped" && /couldn't confirm the answer: It was burgers/.test(s.note)), "stored: 4 live, the one the check failed dropped with why (the parse's drop is on the run)", JSON.stringify(stored));
      check(ran.result.dropped.length === 1 && /episode must be/.test(ran.result.dropped[0].why), "the parse dropped the one about an episode that hasn't aired", JSON.stringify(ran.result.dropped));
    }
    // Again for Episode 5: the batch is replaced, not added to.
    await Bot.runJob(pool, { season, episode: 5, kind: "trivia" }, { ask: standIn(5, cast, []) });
    const five = (await pool.query("SELECT count(*)::int AS n FROM trivia_questions WHERE season_id = $1 AND made_after = 5", [sid])).rows[0].n;
    check(five === 5, "a second run for Episode 5 replaces its batch", String(five));
    // Episode 3's batch was written over a week ago: it's not a round of its own any more.
    await pool.query("UPDATE trivia_questions SET created_at = now() - interval '10 days' WHERE season_id = $1 AND made_after = 3", [sid]);

    // ---------- the round ----------
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: u(who), pass: fixture.PASSWORD });
    const q = (couch) => (couch ? `?couch=${couch}` : "");
    const triviaOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/trivia${q(A)}`)).body;
    const post = (who, body) => as[who].call("POST", `/api/seasons/${sid}/trivia${q(A)}`, body);

    const ta = await triviaOf("alex");
    check(ta.round === `${sid}:5` && ta.questions.length === 3 && ta.questions.every((x) => x.id.startsWith("r:")) && ta.line === "3 questions on episode 5 and the season so far", "alex: Episode 5's batch is the round, three researched questions", `${ta.round} · ${ta.line} · ${ta.questions.map((x) => x.lead).join(" | ")}`);
    const live5 = (await pool.query("SELECT id, question FROM trivia_questions WHERE season_id = $1 AND made_after = 5 AND status = 'live'", [sid])).rows;
    check(ta.questions.every((x) => live5.some((l) => `r:${l.id}` === x.id)), "all three from Episode 5's batch, none the check dropped");
    const num = ta.questions.find((x) => /How many votes/.test(x.lead));
    if (num) check(num.options.map((o) => o.key).join() === "5,6,7,8" && !num.options[0].photo, "a number's options in order, no faces", num.options.map((o) => o.key).join());

    const ts = await triviaOf("sam");
    check(ts.round === "" && ts.questions.length === 3 && ts.questions.some((x) => x.id.startsWith("r:")), "sam (on 3): the week's round, with Episode 3's batch in it", `${ts.round} · ${ts.questions.map((x) => x.id).join()}`);
    const about = new Map((await pool.query("SELECT id, episode, made_after FROM trivia_questions WHERE season_id = $1", [sid])).rows.map((r) => [`r:${r.id}`, r]));
    check(ts.questions.every((x) => !x.id.startsWith("r:") || (about.get(x.id).episode <= 3 && about.get(x.id).made_after === 3)), "nothing about Episodes 4 or 5 for sam", ts.questions.map((x) => x.lead).join(" | "));

    // alex plays it: kept with its round.
    let r = await post("alex", { answers: Object.fromEntries(ta.questions.map((x) => [x.id, x.answer])) });
    check(r.status === 200 && r.body.played?.score === 3, "alex plays it: 3 of 3", JSON.stringify(r.body.played));
    const rows = (await pool.query("SELECT round, score FROM trivia_plays WHERE user_id = $1", [U.alex])).rows;
    check(rows.length === 1 && rows[0].round === `${sid}:5`, "his play is kept with its round", JSON.stringify(rows));
    r = await post("alex", { answers: Object.fromEntries(ta.questions.map((x) => [x.id, "nobody"])) });
    check(r.body.played?.score === 3, "a second play doesn't replace the first");
    const tr = await triviaOf("riley");
    check(tr.round === ta.round && tr.couch.some((p) => p.userId === U.alex && p.score === 3) && !tr.played, "riley: the same round, alex's 3 beside it", JSON.stringify(tr.couch));

    // Wrong?
    const target = tr.questions[0].id;
    r = await post("riley", { flag: target });
    check(r.status === 200 && r.body.ok, "riley flags one", JSON.stringify(r.body));
    check(!(await triviaOf("riley")).questions.some((x) => x.id === target), "it's gone from riley's round");
    check((await triviaOf("jordan")).questions.some((x) => x.id === target), "jordan still has it (one flag)");
    await post("jordan", { flag: target });
    check(!(await triviaOf("sam")).questions.some((x) => x.id === target) && !(await triviaOf("alex")).questions.some((x) => x.id === target), "two flags: gone for everyone");
    r = await post("riley", { flag: ts.questions.find((x) => !x.id.startsWith("r:"))?.id ?? "first:x" });
    check(r.status === 400, "a computed question can't be flagged: 400", `${r.status}`);
    r = await post("riley", { flag: "r:00000000-0000-4000-8000-000000000000" });
    check(r.status === 404, "nor one that isn't there: 404", `${r.status}`);
    await pool.query("DELETE FROM trivia_flags WHERE question_id = $1", [target.slice(2)]);

    // A week on, Episode 5's batch is the week's to ask from, and never what alex already answered.
    await pool.query("UPDATE trivia_questions SET created_at = now() - interval '8 days' WHERE season_id = $1 AND made_after = 5", [sid]);
    const later = await triviaOf("alex");
    check(later.round === "" && !later.questions.some((x) => ta.questions.some((y) => y.id === x.id)) && later.questions.some((x) => x.id.startsWith("r:")), "a week on: the week's round, none he's answered, the rest of the batch in it", `${later.round} · ${later.questions.map((x) => x.id).join()}`);
    await pool.query("UPDATE trivia_questions SET created_at = now() WHERE season_id = $1 AND made_after = 5", [sid]);

    if (!apiOnly) {
      const b = await open({ user: u("riley"), pass: fixture.PASSWORD, width, height: 844, motion: "off" });
      closers.push(b.close);
      const pg = b.page;
      await pg.emulateMedia({ reducedMotion: "reduce" });
      await pg.context().addInitScript(() => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
      });
      let n = 0;
      const shot = async (name) => {
        await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
        await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-riley-${name}.png`) });
      };
      const wide = async (what) => {
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };
      await pg.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const row = pg.locator("[data-this-week] [data-trivia-row]");
      await row.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      check(/ZT Survivor 51 trivia/.test(await row.innerText()) && /3 questions on episode 5/.test(await row.innerText()), "This week: Survivor 51 trivia, on episode 5", await row.innerText());
      await row.click();
      const round = await triviaOf("riley");
      for (const [i, x] of round.questions.entries()) {
        const qa = pg.locator(`[data-trivia-q="${x.id}"]`);
        await qa.waitFor({ timeout: 20_000 });
        await pg.waitForTimeout(300);
        if (i === 0) await shot("trivia-question");
        await qa.locator(`[data-trivia-option="${x.answer}"]`).click();
        if (x.why) {
          const why = pg.locator("[data-trivia-why]");
          await why.waitFor({ timeout: 10_000 });
          check((await why.innerText()).includes(x.why) && /example\.com/.test(await why.innerText()), `question ${i + 1}: what happened, and where it's from`, await why.innerText());
          if (i === 0) {
            await pg.locator("[data-trivia-flag]").click();
            await pg.locator("[data-trivia-flag][disabled]").waitFor({ timeout: 10_000 });
            await shot("trivia-why-flagged");
            await wide("a researched answer");
          }
          await pg.locator("[data-trivia-next]").click();
        }
      }
      await pg.locator("[data-trivia-done]").waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(800);
      check((await pg.locator("[data-trivia-score]").innerText()) === "3/3" && /Level with/.test(await pg.locator("[data-trivia-against]").innerText()), "3/3, level with alex", await pg.locator("[data-trivia-done]").innerText());
      await shot("trivia-done");
      await wide("the score");
      const flagged = (await pool.query("SELECT count(*)::int AS n FROM trivia_flags WHERE user_id = $1", [U.riley])).rows[0].n;
      check(flagged === 1, "her Wrong? was kept", String(flagged));
      const errors = b.errors.filter((x) => !/favicon/.test(x));
      check(!errors.length, "no page errors", errors.join(" | "));
    }
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nAll passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
