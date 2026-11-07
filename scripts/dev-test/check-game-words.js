// Dev-only check of the Start-a-game GPT's words to a spec (docs/PLAN-start-a-game-gpt.md step G1: src/lib/game/game-words/, the
// server's src/lib/server/game-words.ts, POST /api/seasons/[seasonId]/game-words). Two ways:
//
// 1. Through the API, on the stand-in bot (the default): new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51,
//    results through Episode 5), the dev server pointed at fake-bot.js by the x-gys-bot header. No real bot is asked.
//    - jordan's words: the bot is asked once, search off and ahead of its queue (priority "now"); the prompt carries the pack (the
//      couch's 4, the cast as jordan has seen it: no exit past jordan's mark), the manual and the words fenced; the result is a
//      game our check passed, and the ask is a row of game_word_asks with its answer and result.
//    - A typed change: the game so far goes back with the change, and the result is the changed game.
//    - A moment the show doesn't have: the reliability ask goes out too, and its rating comes back as an offer.
//    - The cap: a person's tenth ask in a day is the last (429 after it); the bot down is a 503; a season that isn't one, a 404.
//
//      node scripts/lane.js dev   (or npm run dev; in another terminal)
//      node scripts/dev-test/check-game-words.js [--keep]
//
//    Brings new-fixture.js up and takes it down (--keep leaves it; its asks go with its users); touches zt rows only; refuses a
//    non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
//
// 2. The bank against the real bot (`--real`): the bank's requests (tests/fixtures/game-words/: its hand cases' words and the
//    tracker's requests on a show's page) asked of the LOCAL bot directly, one at a time and only while it's idle (its /health
//    names nobody busy), with this folder's LLM_BROWSER_API_KEY: never through the app's askBot (a lane's LLM_BROWSER_API_URL lists
//    production's bot first) and never production's bot (a URL that isn't loopback is refused). Each answer goes through our check
//    and is scored against the bank: a request the engine plays, the same game (exact) or its shape (typeOf); one it can't, a
//    can't-yet or a question. Writes nothing to any database; the answers go to --out (default: the system's temp folder).
//
//      node scripts/dev-test/check-game-words.js --real [--bot=http://127.0.0.1:8765] [--only=g01,w004] [--limit=10]
//           [--part=cases|requests] [--out=<file.json>] [--provider=chatgpt]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name, dflt) => {
  const a = flag(name);
  return a && a.includes("=") ? a.slice(a.indexOf("=") + 1) : dflt;
};

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

/** The words a game prompt fences: the first fence after THEIR WORDS (or the change's, for a change). */
function fencedAfter(prompt, heading) {
  const at = prompt.indexOf(heading);
  if (at < 0) return "";
  const m = prompt.slice(at).match(/"""\n([\s\S]*?)\n"""/);
  return m ? m[1] : "";
}

// ---- 2. the bank against the real bot ----

async function real() {
  const B = require("../../tests/fixtures/game-words/bank.js");
  const W = require("../../src/lib/game/game-words/index.js");
  const S = require("../../src/lib/game/game-spec/index.js");
  const C = require("../../src/lib/game/game-spec/capabilities.js");
  const bot = value("bot", "http://127.0.0.1:8765").replace(/\/+$/, "");
  const u = new URL(bot);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) throw new Error(`--real asks the local bot only, never ${u.host}`);
  const key = process.env.LLM_BROWSER_API_KEY;
  if (!key) throw new Error("LLM_BROWSER_API_KEY isn't in .env.local");
  const only = (value("only", "") || "").split(",").filter(Boolean);
  const part = value("part", null);
  const limit = Number(value("limit", "0")) || Infinity;
  const out = value("out", path.join(os.tmpdir(), `game-words-${Date.now()}.json`));
  const provider = value("provider", "chatgpt");

  const items = [];
  if (part !== "requests") for (const c of B.cases()) items.push({ id: c.id, page: c.page, words: c.words, expect: c.expect, kind: "case" });
  if (part !== "cases")
    for (const r of B.requests()) {
      if (!r.page || r.page.sport || !r.page.rulebook) continue;
      const ctx = B.ctxOf(r.page);
      const plays = !!r.spec && ctx && !S.specProblems(r.spec, ctx).length && !S.specWaitsFor(r.spec).length;
      items.push({ id: r.id, page: r.page, words: r.words, spec: plays ? r.spec : null, gpt: !!r.gpt, kind: "request" });
    }
  const todo = items.filter((x) => !only.length || only.includes(x.id)).slice(0, limit);
  const examples = B.requests();
  const report = [];
  const idle = async () => {
    for (let i = 0; i < 80; i++) {
      try {
        const h = await (await fetch(`${bot}/health`, { signal: AbortSignal.timeout(5000) })).json();
        if (!h.busy || !h.busy.length) return true;
      } catch {
        /* down: wait as if busy */
      }
      if (i === 0) console.log("      the bot is busy: waiting for it to be free");
      await new Promise((r) => setTimeout(r, 15_000));
    }
    return false;
  };
  for (const x of todo) {
    const ctx = B.ctxOf(x.page);
    const pack = B.packOf(x.page, ctx);
    const manual = W.manualFor(ctx, { examples, show: x.page.show });
    const prompt = W.gamePrompt({ pack, manual, words: x.words });
    if (!(await idle())) throw new Error("the bot stayed busy for 20 minutes: stopped");
    const t0 = Date.now();
    let answer = "";
    let error = null;
    try {
      const res = await fetch(`${bot}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ provider, prompt, search: false, priority: "now", max_wait: 240, keepalive: true }),
        signal: AbortSignal.timeout(270_000),
      });
      const body = JSON.parse((await res.text()).trim() || "{}");
      answer = body.response || "";
      if (!answer) error = body.detail || `HTTP ${res.status}`;
    } catch (e) {
      error = e.message;
    }
    const seconds = (Date.now() - t0) / 1000;
    const r = answer ? W.checkAnswer(answer, { ctx, pack, words: x.words }) : { state: "error" };
    let verdict;
    if (x.kind === "case") verdict = r.state === x.expect.state ? "as expected" : `expected ${x.expect.state}`;
    else if (x.spec) {
      const same = r.spec && JSON.stringify(S.fullSpec(r.spec)) === JSON.stringify(S.fullSpec(x.spec));
      const shape = r.spec && S.typeOf(r.spec) === S.typeOf(x.spec);
      verdict = same ? "exact" : shape ? "its shape" : "missed";
    } else verdict = ["cantYet", "none", "ask"].includes(r.state) ? "asked or refused" : "made a game";
    console.log(`${x.id.padEnd(6)} ${String(r.state).padEnd(10)} ${verdict.padEnd(18)} ${seconds.toFixed(0).padStart(4)}s  ${x.words.slice(0, 70)}${error ? `  (${error})` : ""}`);
    report.push({ id: x.id, page: C.pageName(x.page), words: x.words, prompt: prompt.length, seconds, answer, error, result: r, verdict, expected: x.spec || x.expect || null });
    fs.writeFileSync(out, JSON.stringify(report, null, 1));
  }
  const count = (v) => report.filter((x) => x.verdict === v).length;
  console.log(`\n${report.length} asked: ${["exact", "its shape", "missed", "as expected", "asked or refused", "made a game"].map((v) => `${v} ${count(v)}`).join(" · ")}`);
  console.log(`answers in ${out}`);
}

// ---- 1. through the API, on the stand-in ----

async function api() {
  const { Pool } = require("pg");
  const { api: signIn } = require("./browser");
  const fixture = require("./new-fixture");
  const fakeBot = require("./fake-bot");
  const B = require("../../tests/fixtures/game-words/bank.js");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "next/server": path.join(__dirname, "next-after-stub.js") } });
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-game-words runs against a local database only");
  const { seenThrough } = jiti("../../src/lib/server/guard.ts");
  const pool = new Pool({ connectionString: DB });
  const caseOf = (id) => B.cases().find((c) => c.id === id);
  // The stand-in: the bank's own answers by their words, the change made, every new moment rated high.
  const bot = await fakeBot.start({
    answer: (prompt, kind) => {
      if (kind === "momentAsk") return JSON.stringify({ reliable: "high", why: "Recaps say who got caught out in the rain.", about: "person", question: "This episode, who got caught out in the rain?", label: "Caught in the rain", nearest: ["medevac"] });
      if (kind === "gameChange") return JSON.stringify({ draft: 1, game: { preset: "outlast", get: { by: "draft", each: 4, order: "snake", own: "exclusive" } }, said: [{ part: "get.each", quote: "make it 4 each" }, { part: "preset", quote: "last one standing carries you" }] });
      const words = fencedAfter(prompt, "THEIR WORDS");
      const c = B.cases().find((x) => x.words === words);
      return c ? B.answerOf(c) : '{"game":null}';
    },
  });
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    const headers = { "x-gys-bot": bot.url };
    const jordan = await signIn({ user: "zt_nd_jordan", pass: fixture.PASSWORD, headers });
    const url = `/api/seasons/${sid}/game-words`;

    // Their words to a game.
    const g01 = caseOf("g01");
    const first = await jordan.call("POST", url, { words: g01.words, couch });
    check(first.status === 200, "jordan's words: answered", JSON.stringify(first.body).slice(0, 300));
    const r1 = first.body.result || {};
    check(r1.state === "game" && JSON.stringify(r1.spec) === JSON.stringify(g01.expect.spec), "a game our check passed, the spec the bank expects", JSON.stringify(r1).slice(0, 400));
    check(r1.describe && /Outlast/.test(r1.describe.sentence), `said in the engine's words: "${r1.describe && r1.describe.sentence}"`);
    const asked = bot.asked.filter((a) => a.kind === "gameWords");
    check(asked.length === 1 && asked[0].search === false && asked[0].priority === "now", "the bot asked once, search off, ahead of its queue", JSON.stringify(asked.map((a) => ({ search: a.search, priority: a.priority }))));
    const prompt = asked[0] ? asked[0].prompt : "";
    const packLine = prompt.split("\n").find((l) => l.startsWith('{"page"')) || "{}";
    const pack = JSON.parse(packLine);
    const mark = await seenThrough(fx.users.jordan, sid);
    check(pack.couch && pack.couch.people === 4, `the pack: the couch's 4 (${pack.couch && pack.couch.people})`);
    check(pack.cast.length > 0 && pack.cast.every((c) => !c.out || c.out.episode <= mark), `the pack: the cast as jordan has seen it (no exit past Episode ${mark})`, JSON.stringify(pack.cast.filter((c) => c.out)));
    check(/THE ENGINE'S MANUAL/.test(prompt) && fencedAfter(prompt, "THEIR WORDS") === g01.words, "the prompt: the manual, and their words fenced as data");
    const { rows: rec } = await pool.query("SELECT * FROM game_word_asks WHERE id = $1", [first.body.id]);
    check(rec[0] && rec[0].answer && rec[0].result && rec[0].result.state === "game" && rec[0].couch_id === couch, "the ask is a row, with its answer and our check's result");
    check(first.body.left === 9, `asks left today: ${first.body.left}`);

    // A typed change.
    const changed = await jordan.call("POST", url, { couch, change: { from: first.body.id, words: "make it 4 each" } });
    const r2 = (changed.body && changed.body.result) || {};
    const ask2 = bot.asked.filter((a) => a.kind === "gameChange").at(-1);
    check(ask2 && ask2.prompt.includes(JSON.stringify(r1.spec)) && fencedAfter(ask2.prompt, "THE CHANGE THEY TYPED NOW") === "make it 4 each", "a change: the game so far and the change go back to the bot");
    // 4 of them x 4 each is more than the cast still in as jordan has seen it, so our check makes it shared, and asks.
    check(changed.status === 200 && r2.spec && r2.spec.get && r2.spec.get.each === 4, "...and the result is the changed game", JSON.stringify(changed.body).slice(0, 300));
    check(r2.state === "ask" && r2.fixed.some((f) => f.part === "get.own") && r2.spec.get.own === "shared", "...made shared, since 4 x 4 is more than who's still in, and asked", JSON.stringify(r2.fixed));
    const { rows: rec2 } = await pool.query("SELECT change_of, change, words FROM game_word_asks WHERE id = $1", [changed.body.id]);
    check(rec2[0] && rec2[0].change_of === first.body.id && rec2[0].change === "make it 4 each" && rec2[0].words === g01.words, "the change's row names the ask it changes");
    const notMine = await (await signIn({ user: "zt_nd_sam", pass: fixture.PASSWORD, headers })).call("POST", url, { couch, change: { from: first.body.id, words: "3 each" } });
    check(notMine.status === 404, `someone else's ask can't be changed (${notMine.status})`);

    // A moment the show doesn't have.
    const g08 = caseOf("g08");
    const rain = await jordan.call("POST", url, { words: g08.words, couch });
    const r3 = (rain.body && rain.body.result) || {};
    const rated = bot.asked.filter((a) => a.kind === "momentAsk");
    check(rated.length === 1 && rated[0].search === false && /Will it rain\?/.test(rated[0].prompt), "a new moment: the reliability ask goes out, search off", JSON.stringify(rated.map((a) => a.prompt.slice(0, 120))));
    check(r3.state === "cantYet" && r3.offers && r3.offers.moments && r3.offers.moments.length === 1 && r3.ask.some((a) => a.part === "newMoment"), "...rated high, it comes back as an offer to add it", JSON.stringify(r3).slice(0, 400));

    // G1 part 4: taking the offer adds it to the season's rules, a moment research answers from the next episode to air.
    const addUrl = `/api/seasons/${sid}/added-moments`;
    const add = await jordan.call("POST", addUrl, { ask: rain.body.id });
    const { rows: book } = await pool.query("SELECT r.blocks FROM rulebooks r WHERE r.owner_kind = 'season' AND r.season_id = $1 AND r.status <> 'archived'", [sid]);
    const added = ((book[0] && book[0].blocks.customMoments) || []).find((m) => m.addedFrom);
    check(add.status === 200 && add.body.moment && add.body.existing === false && add.body.words === g08.words, "the offer taken: a moment added", JSON.stringify(add.body).slice(0, 300));
    check(added && added.id === add.body.moment.id && added.answeredBy === "research" && added.counted === "yesNo" && added.question === "This episode, who got caught out in the rain?" && added.reliability === "reliable", "...in the season's rules, research's, its question the rating's", JSON.stringify(added));
    check(added && added.addedFrom === 6 && !((book[0].blocks.points || {})[added.id]), `...asked from the next episode to air (${added && added.addedFrom}), worth nothing in the rules themselves`);
    const again = await jordan.call("POST", addUrl, { ask: rain.body.id });
    check(again.status === 200 && again.body.existing === true && again.body.moment.id === add.body.moment.id, "the same offer again: the one already added, nothing changed");
    const theirs = await (await signIn({ user: "zt_nd_sam", pass: fixture.PASSWORD, headers })).call("POST", addUrl, { ask: rain.body.id });
    check(theirs.status === 404, `someone else's ask can't add it (${theirs.status})`);
    const noOffer = await jordan.call("POST", addUrl, { ask: first.body.id });
    check(noOffer.status === 400, `an ask with no moment offered adds nothing (${noOffer.status})`);
    // Asked again, it's on the page: one of the moments research answers, so a game on it can be made.
    const reask = await jordan.call("POST", url, { words: g08.words, couch });
    const reasked = bot.asked.filter((a) => a.kind === "gameWords").at(-1);
    const pack2 = JSON.parse((reasked ? reasked.prompt : "").split("\n").find((l) => l.startsWith('{"page"')) || "{}");
    check(reask.status === 200 && (pack2.moments || []).some((m) => m.id === add.body.moment.id), "asked again, the pack lists it among the moments research answers", JSON.stringify((pack2.moments || []).map((m) => m.id)));

    // The cap, the bot down, a season that isn't one.
    await pool.query(
      "INSERT INTO game_word_asks (user_id, season_id, words) SELECT $1, $2, 'filler' FROM generate_series(1, $3)",
      [fx.users.jordan, sid, 10 - 4 - 1]
    );
    const tenth = await jordan.call("POST", url, { words: g01.words, couch });
    check(tenth.status === 200 && tenth.body.left === 0, `the tenth ask today is answered, the last (${tenth.status}, ${tenth.body && tenth.body.left} left)`);
    const eleventh = await jordan.call("POST", url, { words: g01.words, couch });
    check(eleventh.status === 429, `the eleventh is refused (${eleventh.status}: ${eleventh.body && eleventh.body.error})`);
    bot.down = true;
    const down = await (await signIn({ user: "zt_nd_riley", pass: fixture.PASSWORD, headers })).call("POST", url, { words: g01.words, couch });
    check(down.status === 503, `the bot down: ${down.status}, "${down.body && down.body.error}"`);
    bot.down = false;
    const none = await jordan.call("POST", `/api/seasons/00000000-0000-4000-8000-000000000000/game-words`, { words: "a pool" });
    check(none.status === 404, `a season that isn't one: ${none.status}`);
    if (!flag("keep")) await fixture.down(pool);
  } finally {
    await bot.close();
    await pool.end();
  }
}

(flag("real") ? real() : api())
  .then(() => {
    if (!flag("real")) console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
