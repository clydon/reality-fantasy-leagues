// Dev-only check for how results and rules settle without the admin (docs/PLAN-new-design.md step 6c part 2), against
// the dev server, on new-fixture.js (couch A "ZT Survivor 51": alex runs its three games, riley a Game admin of one,
// jordan and sam play; couch B "ZT Extra": alex runs it, casey plays) with a stand-in for the ask-AI bot (fake-bot.js,
// through the dev-only x-gys-bot header: neither ChatGPT nor production's VM is asked). The season is moved so Episode 6
// ended six minutes ago, with nothing in. Added here: the desk's own admin (zt_nd_desk).
//   1. Nobody went home, by hand, in the browser: the sheet's "Nobody went home", the preview, applied to every league on
//      the season (each episode marked, early, nobody out), a source of alex's; Undo. A quick check that says nobody went
//      home waits; Show me says so; It's right applies it.
//   2. A split: casey's full answer (Cristian voted out) disagrees with alex's "nobody": both facts disputed, nothing
//      moves in the games; the desk's Inbox has the split at once while the tie-break run is off.
//   3. The tie-break run (the desk's switch): off, the clock plans nothing for it; on (Settings, a History line), the split
//      waits for it in the Inbox and Backstage says when the bot checks; the clock's `next` is a day after the split. A
//      bot that's down fails it three times, then the split is the desk's. A new answer opens it again; the tie-break run
//      (source tiebreak, nobody's) settles it: Cristian out everywhere, "nobody went home" removed with a correction line.
//      A flag raised after it gets its own tie-break, a day later.
//   4. Something the rulebook doesn't have: casey's research said Episode 6 brought a Block a Vote advantage. alex sees it
//      (another couch reported it; one more yes adds it), sam can't before he's seen it; jordan says Not new in the
//      browser (a split, in the Inbox); alex says It's new: our bot works out what to add (only the twist, not its other
//      edits), the season's rulebook has it from Episode 6 (a 'community' edit, History with Undo), the card says so.
//      Undo takes it out. Episode 5, the rulebook locked: confirmed goes to the desk, which puts it away. Episode 4: two
//      couches saying Not new put it away.
//   5. The desk's bot settings in the browser: Settings (the tie-break sheet and what it reaches, Autopilot's trial), a
//      season's page (the bot's schedule on, a run switched off, Undo from History).
// Every real league's state is the same at the end. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/check-new-settling.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only, and puts the tie-break switch
// back as it was. Refuses a non-local database, and stops if another local season has bot research on or a question open
// (the clock's runs and the tie-break plan every season). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./new-fixture");
const fakeBot = require("./fake-bot");
// The usual runs a season switched on starts with (the default schedule: it grew trivia, then bingo, since this was written).
const { DEFAULT_SCHEDULE } = require("../../db/bot-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-settling runs against a local database only");
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-settling.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const OUT6 = "Cristian Chavez";
const NOTE = "A new Block a Vote advantage: whoever finds it can take away someone's vote at Tribal Council.";
const DAY = 24 * 3600 * 1000;
const DESK = fixture.username("desk");
const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";

const quickAnswer = (left, sources = 2) =>
  "```json\n" + JSON.stringify({ found: true, episodeTitle: null, left, headline: "Nobody went home tonight.", sources: Array.from({ length: sources }, (_, i) => `https://news${i}.example/ep6`) }) + "\n```";

// A full answer from the prompt's own skeleton: everyone answered (high confidence), Cristian voted out, Danny's immunity;
// `note`: research's own flag that the show changed how it's played.
function fullAnswer(prompt, { note = null } = {}) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode six.";
  a.tribalCouncilHeld = "yes";
  a.rulesNote = note;
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  const who = (name) => a.castaways.find((c) => c.name === name);
  Object.assign(who(OUT6), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5 });
  Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  return "```json\n" + JSON.stringify(a) + "\n```";
}

// The rulebook prompt's answer: the rulebook it was sent with Block a Vote added, and a tagline it had no business changing
// (only what's added may go in).
function rulebookAnswer(prompt) {
  const at = prompt.indexOf("If it describes something the rulebook already has");
  const blocks = JSON.parse(prompt.slice(prompt.indexOf("{", at)));
  blocks.tagline = "Something else entirely";
  blocks.twists = [...(blocks.twists || []), { id: "blockAVote", type: "advantage", name: "Block a Vote", summary: "Takes away someone's vote at Tribal Council.", oneIsCalled: "a Block a Vote", gotBy: "found", does: ["hurtsSomeone"], lasts: "oneUse" }];
  return "```json\n" + JSON.stringify(blocks) + "\n```";
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const bot = await fakeBot.start({});
  closers.push(bot.close);
  const realBefore = (await pool.query(REAL_LEAGUES)).rows;
  const tiebreakWas = (await pool.query("SELECT value FROM app_settings WHERE key = 'tiebreak'")).rows[0];
  try {
    const others = (await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on AND s.slug <> 'zt-nd-survivor'")).rows;
    if (others.length) throw new Error(`another local season has bot research on (${others.map((r) => r.slug).join(", ")}): it would share the clock`);
    const open0 = (await pool.query(
      `SELECT count(*)::int AS n FROM (
         SELECT season_id FROM season_decisions WHERE fact_status = 'disputed' AND locked_at IS NULL
         UNION ALL SELECT season_id FROM fact_disputes WHERE status = 'open') q
        JOIN show_seasons ss ON ss.id = q.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`
    )).rows[0].n;
    if (open0) throw new Error(`${open0} question(s) open on real local seasons: a tie-break run would ask about them`);

    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const A = `?couch=${fx.couchId}`;
    const B = `?couch=${fx.extraCouchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("DELETE FROM app_settings WHERE key = 'tiebreak'");
    // Episode 6 (weekly from the premiere, 90 minutes) ended six minutes ago.
    await pool.query(
      `UPDATE show_seasons SET air_time = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::time,
              premiere_date = ((now() - interval '96 minutes') AT TIME ZONE air_tz)::date - 35 WHERE id = $1`,
      [sid]
    );

    const H = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: DESK, pass: fixture.PASSWORD, headers: H }) };
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD, headers: H });
    const ep6 = async (key) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]]);
      const ep = rows[0].state.episodes.find((e) => e.number === 6) || { events: [], scoringEvents: [] };
      const has = !!ep.noExit || ep.events.length > 0 || (ep.scoringEvents || []).length > 0;
      return { outs: ep.events.length, events: (ep.scoringEvents || []).length, noExit: !!ep.noExit, stage: has ? ep.resultsStage || "final" : null };
    };
    const all6 = () => Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    const subs = async () =>
      (await pool.query(`SELECT er.id, source, submitted_by, couch_id, covers, researched_at FROM episode_research er JOIN shows s ON s.id = er.show_id WHERE s.slug = 'zt-nd-survivor' AND source <> 'combined' AND withdrawn_at IS NULL AND episode_number = 6 ORDER BY researched_at`)).rows;
    const fact = async (kind, name) => (await pool.query("SELECT id, status, fact_status FROM season_decisions WHERE season_id = $1 AND episode_number = 6 AND kind = $2 AND castaway_name = $3", [sid, kind, name])).rows[0] ?? null;
    const linesOf = async (k, kind) => (await pool.query("SELECT text, batch, detail, undone_at FROM league_changes WHERE league_id = $1 AND kind = $2 ORDER BY created_at", [L[k], kind])).rows;
    const undo = (who, batch, couch = A) => as[who].call("POST", `/api/seasons/${sid}/changes/${encodeURIComponent(batch)}/undo${couch}`);
    const backstage = async (who = "alex", couch = A, show = false) => (await as[who].call("GET", `/api/seasons/${sid}/backstage${couch}&episode=6${show ? "&show=1" : ""}`)).body;
    const inbox = async () => (await as.desk.call("GET", "/api/desk/inbox")).body.items.filter((i) => /ZT Survivor 51/.test(`${i.title} ${i.line}`));
    const cron = async (method, at) => {
      const r = await fetch(`${BASE}/api/cron/bot-research?now=${encodeURIComponent(new Date(at).toISOString())}`, { method, headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...H } });
      return r.json();
    };
    const reveal = (who, couch, n) => as[who].call("POST", `/api/seasons/${sid}/reveal`, { episode: n, couch });
    const change = async (who, couch, n) => (await as[who].call("GET", `/api/seasons/${sid}/show-changes/${n}${couch}`)).body.change;
    const sayNew = (who, couch, n, isNew) => as[who].call("POST", `/api/seasons/${sid}/show-changes/${n}${couch}`, { isNew });

    // ---- the browser, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page } = b;
    await page.context().setExtraHTTPHeaders(H);
    const hideOverlay = (p) =>
      p.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
    await hideOverlay(page);
    const failed = [];
    const watch = (p) => p.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    watch(page);
    let n = 0;
    const shot = async (name, p = page) => {
      await Promise.race([settle(p), p.waitForTimeout(3000)]);
      await p.waitForTimeout(250);
      await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const fits = async (where, p = page) => {
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re, p = page) => {
      try {
        await p.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await p.getByRole("status").first().textContent().catch(() => "")) || "").trim();
    };

    // ---- 1. nobody went home ----
    await page.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
    await page.locator("[data-quick=ask]").waitFor({ timeout: 20000 });
    await page.locator("[data-by-hand]").click();
    await page.locator("[data-by-hand-sheet]").waitFor();
    await page.locator("[data-nobody]").click();
    check((await page.locator("[data-nobody][aria-pressed=true]").count()) === 1, "the by-hand sheet: Nobody went home, picked");
    await fits("the by-hand sheet");
    await shot("nobody-picked");
    await page.getByRole("button", { name: "See what changes" }).click();
    await page.locator("[data-guard='2']").waitFor();
    await page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    const guardText = await page.locator("[role=dialog][data-open]").innerText();
    check(/Nobody went home in Episode 6/.test(guardText), "the preview says nobody went home in Episode 6", guardText.slice(0, 300));
    await shot("nobody-preview");
    await page.locator("[data-guard-confirm]").click();
    check(/Applied to 3 games/.test(await toasted(/Applied to 3 games/)), "applied to the three games here");
    await page.locator("[data-quick=in]").waitFor();
    let e = await all6();
    check(e.every((x) => x.noExit && x.outs === 0 && x.stage === "early"), "every league on the season: Episode 6 has results, nobody out, early (couch B's too)", JSON.stringify(e));
    let s = (await subs()).at(-1);
    check(s.source === "hand" && s.submitted_by === fx.users.alex && JSON.stringify(s.covers.kinds) === '["elimination","noexit"]', "a source of alex's: by hand, answering for who went home", JSON.stringify(s));
    let nx = await fact("noexit", "");
    check(nx?.status === "accepted" && nx.fact_status === "reported", "the shared fact: nobody went home, reported, in every league", JSON.stringify(nx));
    await page.locator("[data-quick=in] [data-show-me]").click();
    await page.getByText("Nobody went home", { exact: true }).first().waitFor({ timeout: 10000 });
    check(true, "Show me: Nobody went home");
    await shot("nobody-in");
    const handBatch = (await linesOf("lineup", "results.quick")).at(-1).batch;
    check((await undo("alex", handBatch)).status === 200, "Undo takes it back");
    e = await all6();
    check(e.every((x) => !x.noExit && x.stage === null), "every league back to nothing in", JSON.stringify(e));

    // A quick check that says nobody went home waits; It's right applies it.
    const pasted = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${A}`, { episode: 6, kind: "quick", answer: quickAnswer([]) });
    check(pasted.body.waiting?.doubt === "nobody" && pasted.body.waiting.id, "a quick check saying nobody went home waits", JSON.stringify(pasted.body));
    await page.reload();
    await page.locator("[data-quick=waiting]").waitFor({ timeout: 20000 });
    await page.locator("[data-quick=waiting] [data-show-me]").click();
    await page.locator("[data-wait-names]").waitFor();
    check(/It says nobody went home/.test(await page.locator("[data-wait-names]").innerText()), "Show me: it says nobody went home");
    check(await page.locator("[data-wait-right]").isEnabled(), "and It's right can be tapped");
    await shot("nobody-waits");
    await page.locator("[data-wait-right]").click();
    await page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    await page.locator("[data-guard-confirm]").click();
    check(/Applied to 3 games/.test(await toasted(/Applied to 3 games/)), "It's right: applied");
    check((await pool.query("SELECT outcome FROM quick_waits WHERE id = $1", [pasted.body.waiting.id])).rows[0].outcome === "right", "the answer that waited closes as right");
    e = await all6();
    check(e.every((x) => x.noExit && x.stage === "early"), "every league: nobody went home, early", JSON.stringify(e));

    // ---- 2. a split: casey's full answer says Cristian went home ----
    check((await reveal("casey", fx.extraCouchId, 6)).status === 200, "casey reveals Episode 6");
    const cPrompt = (await as.casey.call("GET", `/api/seasons/${sid}/backstage/prompt${B}&episode=6&kind=full`)).body.prompt;
    const cSent = await as.casey.call("POST", `/api/seasons/${sid}/backstage/results${B}`, { episode: 6, kind: "full", answer: fullAnswer(cPrompt, { note: NOTE }) });
    check(cSent.status === 200, "casey fills in Episode 6 from couch B", JSON.stringify(cSent.body).slice(0, 200));
    const splitAt = new Date((await subs()).at(-1).researched_at).getTime();
    nx = await fact("noexit", "");
    const cr = await fact("elimination", OUT6);
    check(nx.fact_status === "disputed" && nx.status === "accepted", "nobody went home: disputed, and stays as it was until it's settled", JSON.stringify(nx));
    check(cr.fact_status === "disputed" && cr.status !== "accepted", "Cristian voted out: disputed, not in the games", JSON.stringify(cr));
    e = await all6();
    check(e.every((x) => x.noExit && x.outs === 0), "the games: still nobody out", JSON.stringify(e));
    check((await backstage()).episode.questions >= 1, "Backstage: Episode 6 has a question open");
    let ib = await inbox();
    check(ib.some((i) => i.kind === "split" && /Nobody went home/.test(i.title)) && ib.some((i) => i.kind === "split" && i.title.startsWith(OUT6)), "the tie-break run off: the split is the desk's at once", JSON.stringify(ib));

    // ---- 3. the tie-break run ----
    let plan = await cron("GET", splitAt + DAY + 60000);
    check(!plan.due.length && plan.next === null, "off: the clock plans nothing for it", JSON.stringify(plan));
    check((await as.jordan.call("PUT", "/api/desk/settings", { tiebreak: true })).status === 403, "the switch is the desk's (jordan refused)");
    const on = await as.desk.call("PUT", "/api/desk/settings", { tiebreak: true });
    check(on.status === 200 && on.body.settings.tiebreak.on === true && on.body.settings.tiebreak.reach.includes("ZT Survivor 51"), "the desk switches the tie-break run on; it reaches every airing season", JSON.stringify(on.body.settings?.tiebreak));
    check(on.body.history.some((h) => /When a result is disputed: the bot asks again/.test(h.text) && h.undoable), "a line in Settings' History, with Undo");
    plan = await cron("GET", splitAt + DAY - 3600000);
    check(!plan.due.length && Math.abs(Date.parse(plan.next) - (splitAt + DAY)) < 2000, "on: the clock's next call is a day after the split", JSON.stringify(plan));
    const bs3 = await backstage();
    check(Math.abs(Date.parse(bs3.episode.tiebreakAt) - (splitAt + DAY)) < 2000, "Backstage says when our bot checks it", JSON.stringify(bs3.episode));
    ib = await inbox();
    check(!ib.some((i) => i.kind === "split" || i.kind === "stale"), "the split waits for its tie-break before it's the desk's", JSON.stringify(ib));
    bot.down = true;
    for (let i = 1; i <= 3; i++) {
      const r = await cron("POST", splitAt + DAY + i * 60000);
      check(r.job?.kind === "tiebreak" && r.job.episode === 6 && r.ok === false, `a bot that's down: tie-break try ${i} fails`, JSON.stringify(r).slice(0, 200));
    }
    plan = await cron("GET", splitAt + DAY + 5 * 60000);
    check(!plan.due.length, "after three tries, no more", JSON.stringify(plan));
    ib = await inbox();
    check(ib.some((i) => i.kind === "split" && /the sources split$/.test(i.line)), "and the split is the desk's", JSON.stringify(ib));
    bot.down = false;
    // casey checks it again: a new answer opens the question again, and its tie-break comes a day later.
    const cAgain = await as.casey.call("POST", `/api/seasons/${sid}/backstage/results${B}`, { episode: 6, kind: "full", answer: fullAnswer(cPrompt, { note: NOTE }) });
    check(cAgain.status === 200, "casey sends it again");
    const againAt = new Date((await subs()).at(-1).researched_at).getTime();
    plan = await cron("GET", againAt + DAY - 60000);
    check(Math.abs(Date.parse(plan.next) - (againAt + DAY)) < 2000, "its tie-break is a day after that answer", JSON.stringify(plan));
    bot.answer = (p, kind) => (kind === "full" ? fullAnswer(p) : "{}");
    bot.asked.length = 0;
    const tb = await cron("POST", againAt + DAY + 60000);
    check(tb.job?.kind === "tiebreak" && tb.ok === true && /^Tie-break:/.test(tb.message), "the tie-break run: the bot asks Episode 6 once more", JSON.stringify(tb).slice(0, 300));
    check(bot.asked.length === 1 && bot.asked[0].kind === "full", "one full question");
    s = (await subs()).at(-1);
    check(s.source === "tiebreak" && s.submitted_by === null && s.couch_id === null, "a source of its own: the tie-break, nobody's", JSON.stringify(s));
    nx = await fact("noexit", "");
    const cr2 = await fact("elimination", OUT6);
    check(cr2.fact_status === "confirmed" && cr2.status === "accepted", "Cristian voted out: confirmed, in every league", JSON.stringify(cr2));
    check(nx.fact_status === "removed" && nx.status !== "accepted", "nobody went home: removed", JSON.stringify(nx));
    e = await all6();
    check(e.every((x) => x.outs === 1 && !x.noExit && x.stage === "final"), "every league: Cristian out, final, the mark gone", JSON.stringify(e));
    const corr = await linesOf("extra", "results.correction");
    check(corr.length >= 1 && corr.at(-1).detail.facts.some((f) => f.change === "removed" && f.label === "Nobody went home"), "a correction line: nobody went home, removed", JSON.stringify(corr.map((c) => c.detail?.facts)));
    check((await pool.query("SELECT kind, ok FROM bot_research_runs WHERE season_id = $1 AND kind = 'tiebreak' AND ok", [sid])).rows.length === 1, "the run is kept (kind tiebreak)");
    ib = await inbox();
    check(!ib.some((i) => i.kind === "split" || i.kind === "stale"), "nothing for the desk now", JSON.stringify(ib));
    check(!(await backstage()).episode.questions, "Backstage: no question open");
    plan = await cron("GET", Date.now());
    check(!plan.due.length && plan.next === null, "and no tie-break left to plan", JSON.stringify(plan));
    // A flag raised after it gets its own, a day later.
    check((await reveal("jordan", fx.couchId, 6)).status === 200, "jordan reveals Episode 6");
    const danny = (await pool.query("SELECT id FROM season_decisions WHERE season_id = $1 AND episode_number = 6 AND kind = 'event' AND castaway_name = 'Danny Kilby'", [sid])).rows[0].id;
    const flag = await as.jordan.call("POST", `/api/seasons/${sid}/disputes${A}`, { episode: 6, decisionId: danny, reason: "didnt-happen", note: "He lost it to Eric" });
    check(flag.status === 200, "jordan flags Danny's immunity");
    const flagAt = (await pool.query("SELECT created_at FROM fact_disputes WHERE decision_id = $1", [danny])).rows[0].created_at.getTime();
    plan = await cron("GET", flagAt + 3600000);
    check(Math.abs(Date.parse(plan.next) - (flagAt + DAY)) < 2000, "a flag after the tie-break: its own, a day after it was raised", JSON.stringify(plan));
    await page.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
    await page.locator("[data-question='6']").waitFor({ timeout: 20000 });
    check(/If nobody checks it, our bot does/.test(await page.locator("[data-question='6']").innerText()), "Backstage: if nobody checks it, our bot does");
    await page.locator("[data-question='6']").scrollIntoViewIfNeeded();
    await fits("Backstage with a question open");
    await shot("question-tiebreak");

    // ---- 4. something the rulebook doesn't have ----
    check((await reveal("alex", fx.couchId, 6)).status === 200, "alex reveals Episode 6");
    let c = await change("alex", A, 6);
    check(c?.status === "open" && c.note === NOTE && c.yes === 1 && c.no === 0 && c.need === 2 && !c.reportedHere, "alex sees it: another couch's research reported it, one more yes adds it", JSON.stringify(c));
    check((await change("alex", B, 6))?.reportedHere === true, "on couch B, its own research found it");
    check((await change("sam", A, 6)) === null && (await sayNew("sam", A, 6, true)).status === 403, "sam hasn't seen Episode 6: nothing, and refused");
    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    await j.page.context().setExtraHTTPHeaders(H);
    await hideOverlay(j.page);
    watch(j.page);
    const openEp = async (p, ep) => {
      await p.goto(`${BASE}/show/${sid}/episodes`);
      await p.locator(`[data-ep='${ep}']`).click();
      await p.locator(`[data-show-change='${ep}']`).waitFor({ timeout: 20000 });
      await p.locator(`[data-show-change='${ep}']`).scrollIntoViewIfNeeded();
    };
    await openEp(j.page, 6);
    const card = j.page.locator("[data-show-change='6']");
    check(/Something the rulebook doesn.t have/.test(await card.innerText()) && (await card.innerText()).includes("Block a Vote"), "jordan's Episode 6 page: something the rulebook doesn't have, research's note");
    await fits("the episode page with the card", j.page);
    await shot("show-change-open", j.page);
    await card.locator("[data-show-change-not]").click();
    check(/Thanks/.test(await toasted(/Thanks/, j.page)), "Not new: thanks");
    await j.page.waitForFunction(() => /You said it.s not new/.test(document.querySelector("[data-show-change='6']")?.textContent || ""), null, { timeout: 10000 });
    check(/our admin checks it/.test(await card.innerText()), "a split: our admin checks it");
    await shot("show-change-split", j.page);
    ib = await inbox();
    check(ib.some((i) => i.kind === "change" && /Episode 6/.test(i.title) && /The couches split/.test(i.line)), "the desk's Inbox: the couches split", JSON.stringify(ib));
    bot.answer = (p, kind) => (kind === "rulebook" ? rulebookAnswer(p) : "{}");
    bot.asked.length = 0;
    const yes = await sayNew("alex", A, 6, true);
    check(yes.status === 200 && yes.body.change?.status === "checking", "alex: It's new (couch A's newest answer) · two couches agree, our bot adds it", JSON.stringify(yes.body));
    for (let i = 0; i < 50 && (c = await change("alex", A, 6))?.status === "checking"; i++) await new Promise((r) => setTimeout(r, 400));
    check(c?.status === "added" && /Block a Vote/.test(c.added?.summary || "") && c.added.from === 6, "it's in the rulebook from Episode 6", JSON.stringify(c));
    check(bot.asked.length === 1 && bot.asked[0].kind === "rulebook" && bot.asked[0].prompt.includes("Block a Vote") && /Change nothing else/.test(bot.asked[0].prompt), "the bot was asked the rulebook prompt with the note, once");
    const bookId = (await pool.query("SELECT rulebook_id FROM show_seasons WHERE id = $1", [sid])).rows[0].rulebook_id;
    const edit = (await pool.query("SELECT id, source, from_episode, status, ops FROM rulebook_edits WHERE rulebook_id = $1 AND source = 'community'", [bookId])).rows;
    check(edit.length === 1 && edit[0].from_episode === 6 && edit[0].status === "in_force" && edit[0].ops.every((o) => o.op === "add" && o.block === "twists"), "a 'community' edit from Episode 6: only the twist added", JSON.stringify(edit));
    const deskBook = (await as.desk.call("GET", `/api/desk/rulebooks/${bookId}`)).body;
    check(deskBook.now.twists.some((t) => t.id === "blockAVote") && deskBook.now.tagline !== "Something else entirely", "the rulebook has Block a Vote, and kept its tagline", deskBook.now.tagline);
    const line = deskBook.history.find((h) => /couches confirmed Episode 6/.test(h.text));
    check(!!line?.undoable, "the desk's History: the couches confirmed it, with Undo", JSON.stringify(deskBook.history.slice(0, 3)));
    check((await pool.query("SELECT ok FROM bot_research_runs WHERE season_id = $1 AND kind = 'rulebook'", [sid])).rows[0]?.ok === true, "the bot's run is kept (kind rulebook)");
    ib = await inbox();
    check(!ib.some((i) => i.kind === "change"), "the Inbox: nothing about it now");
    await j.page.reload();
    await openEp(j.page, 6);
    check(/in the rulebook now/.test(await card.innerText()), "jordan's card: it's in the rulebook now");
    const plate = (await j.page.locator("[data-corrected]").allInnerTexts()).join(" | ");
    check(plate.includes("Nobody went home, taken out") && !plate.includes("· Nobody"), "the episode's Corrected plate: Nobody went home, taken out", plate);
    await shot("show-change-added", j.page);
    check((await as.desk.call("POST", `/api/desk/changes/${line.id}/undo`)).status === 200, "the desk undoes it");
    check((await pool.query("SELECT status FROM rulebook_edits WHERE id = $1", [edit[0].id])).rows[0].status === "withdrawn" && (await change("alex", A, 6)) === null, "withdrawn: the card goes");

    // Episode 5, the rulebook locked: confirmed, it's the desk's; the desk puts it away.
    const seed = (ep) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers)
         SELECT ss.show_id, ss.season_number, $2, $3::jsonb, '{}'::jsonb, 'paste', $4, $5, '{"only": true}'::jsonb FROM show_seasons ss WHERE ss.id = $1`,
        [sid, ep, JSON.stringify({ rulesNote: `Episode ${ep}: a new twist the rulebook doesn't have.` }), fx.users.casey, fx.extraCouchId]
      );
    await seed(5);
    check((await as.desk.call("POST", `/api/desk/rulebooks/${bookId}`, { action: "lock", lock: true })).status === 200, "the desk locks the rulebook");
    const y5 = await sayNew("jordan", A, 5, true);
    check(y5.body.change?.status === "desk" && /locked/.test(y5.body.change.line || ""), "Episode 5, confirmed but locked: our admin checks it", JSON.stringify(y5.body));
    ib = await inbox();
    check(ib.some((i) => i.kind === "change" && /Episode 5/.test(i.title) && /locked/.test(i.line)), "the Inbox has it", JSON.stringify(ib));
    const notices = (await as.desk.call("GET", `/api/desk/rulebooks/${bookId}`)).body.notices;
    const n5 = notices.find((x) => x.episode === 5);
    check(!!n5, "the rulebook's page has it");
    check((await as.desk.call("POST", `/api/desk/rulebooks/${bookId}`, { action: "notice", notice: n5.id, status: "not_new" })).status === 200 && (await change("jordan", A, 5)) === null, "the desk: not new, and the card goes");
    await as.desk.call("POST", `/api/desk/rulebooks/${bookId}`, { action: "lock", lock: false });
    // Episode 4: two couches say Not new.
    await seed(4);
    check((await sayNew("jordan", A, 4, false)).body.change?.status === "open", "Episode 4: jordan says Not new (a split with couch B's research)");
    const n4 = await sayNew("casey", B, 4, false);
    check(n4.status === 200 && n4.body.change === null && (await pool.query("SELECT status FROM rulebook_notices WHERE season_id = $1 AND episode_number = 4", [sid])).rows[0].status === "not_new", "casey (couch B) says Not new too: put away");

    // ---- 5. the desk's bot settings ----
    const d = await open({ user: DESK, pass: fixture.PASSWORD, width, height: 844 });
    closers.push(d.close);
    await hideOverlay(d.page);
    watch(d.page);
    await d.page.goto(`${BASE}/desk/settings`);
    await d.page.locator("[data-desk-row='tiebreak']").waitFor({ timeout: 20000 });
    check(/The bot asks again after a day/.test(await d.page.locator("[data-desk-row='tiebreak']").innerText()), "Settings: the tie-break run is on");
    await fits("the desk's Settings", d.page);
    await shot("desk-settings", d.page);
    await d.page.locator("[data-desk-row='tiebreak']").click();
    await d.page.locator("[data-tiebreak-reach]").waitFor();
    check(/ZT Survivor 51/.test(await d.page.locator("[data-tiebreak-reach]").innerText()), "its sheet says which airing seasons it reaches");
    await shot("desk-tiebreak-sheet", d.page);
    await d.page.locator("[data-tiebreak=false]").click();
    check(/it waits for a couch/.test(await toasted(/it waits for a couch/, d.page)), "switched off from the sheet");
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'tiebreak'")).rows[0].value === false, "stored: off");
    await d.page.goto(`${BASE}/desk/season/${sid}`);
    await d.page.locator("[data-season-bot]").waitFor({ timeout: 20000 });
    await d.page.locator("[data-season-bot]").scrollIntoViewIfNeeded();
    await fits("the season's page with the bot", d.page);
    await shot("desk-season-bot-off", d.page);
    await d.page.locator("[data-switch=bot]").click();
    check(/The bot's schedule is on/.test(await toasted(/schedule is on/, d.page)), "the season's bot switched on");
    await d.page.locator("[data-switch=bot][data-on=on]").waitFor();
    let row = (await pool.query("SELECT bot_research_on, bot_research_since, bot_research_schedule FROM show_seasons WHERE id = $1", [sid])).rows[0];
    check(row.bot_research_on && row.bot_research_since && row.bot_research_schedule.length === DEFAULT_SCHEDULE.length, "stored: on, from now, the usual runs", JSON.stringify(row));
    await d.page.locator("[data-switch='run-quick@5']").click();
    await toasted(/Who went home off/, d.page);
    await d.page.locator("[data-switch='run-quick@5'][data-on=off]").waitFor();
    row = (await pool.query("SELECT bot_research_schedule FROM show_seasons WHERE id = $1", [sid])).rows[0];
    check(row.bot_research_schedule.find((r) => r.kind === "quick").on === false, "a run switched off");
    await d.page.locator("[data-season-bot]").scrollIntoViewIfNeeded();
    await shot("desk-season-bot-on", d.page);
    const hist = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body.history;
    check(hist[0] && /changed/.test(hist[0].text) && hist[0].undoable && /switched on/.test(hist[1]?.text || ""), "History: both changes, with Undo", JSON.stringify(hist.slice(0, 2)));
    await d.page.locator(`[data-undo-desk='${hist[0].id}']`).click();
    await d.page.waitForFunction(() => document.querySelector("[data-switch='run-quick@5']")?.getAttribute("data-on") === "on", null, { timeout: 10000 });
    check(true, "Undo from History: the run's back on");
    await d.page.goto(`${BASE}/desk/settings`);
    await d.page.locator("[data-desk-row='autopilot']").click({ timeout: 20000 });
    await d.page.locator("[data-autopilot]").waitFor({ timeout: 20000 });
    check(/ZT Survivor 51/.test(await d.page.locator("[data-autopilot]").innerText()) && /Checks who went home, the full results, trivia questions and bingo squares/.test(await d.page.locator("[data-autopilot]").innerText()), "Settings › Our bot › Autopilot: the season, and what it checks");
    await d.page.locator("[data-autopilot]").scrollIntoViewIfNeeded();
    await shot("desk-autopilot", d.page);

    check(failed.length === 0, "no failed requests", failed.join(", "));
    check(b.errors.length === 0 && j.errors.length === 0 && d.errors.length === 0, "no page errors", [...b.errors, ...j.errors, ...d.errors].join(" | "));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    for (const cl of closers.reverse()) await cl().catch(() => {});
    if (tiebreakWas) await pool.query("INSERT INTO app_settings (key, value, updated_at) VALUES ('tiebreak', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(tiebreakWas.value)]);
    else await pool.query("DELETE FROM app_settings WHERE key = 'tiebreak'");
    if (!keep) await fixture.down(pool).catch((er) => console.error("down failed", er));
    const realAfter = (await pool.query(REAL_LEAGUES)).rows;
    check(JSON.stringify(realAfter) === JSON.stringify(realBefore), "every real league is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
