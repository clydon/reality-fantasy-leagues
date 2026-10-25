// Dev-only check for results from everyone and disputes (docs/PLAN-new-design.md step 6b, part 1), against the dev
// server, on new-fixture.js: couch A ("ZT Survivor 51": alex runs its three games, riley a Game admin of one, jordan
// and sam play) and couch B ("ZT Extra": alex runs it, casey plays) on one zt Survivor 51, results through Episode 5;
// the season is moved back five days here so Episode 6 has aired with nothing in, and a result staged before 6b and
// never reviewed (Sharonda's idol) waits in season_decisions, as Survivor 51's 59 do.
//   1. Who went home: alex's quick check is a submission of its own (source quick, who sent it, from which couch) and
//      reaches every game on the season, couch B's too; only couch A's Recent changes get a line.
//   2. Anyone fills in: jordan (a player) gets Tonight's "Full scores need one paste" once he's seen Episode 6 (not
//      sam, who hasn't; not alex, who runs the games; not while the couch says only people who run games), fills it in
//      through Ask an AI in the browser, and every game on the season scores: trusted results reached everyone, one at
//      medium confidence waits, who went home is confirmed by two people. His line is his to undo; sam's isn't.
//   3. "Something wrong?": jordan flags Eric's reward from the episode page (who → which result → why); riley flags
//      Danny's immunity over the API; sam can't flag what he hasn't seen. Disputed, nothing changes, and Backstage asks
//      for one more answer.
//   4. Couch B's casey sends the check: Danny's immunity stands (riley's flag kept), Eric's reward comes out of every
//      league with a correction line (jordan's flag upheld), Devin's idol is split and stays out.
//   5. A house ruling: alex keeps Eric's reward in couch A's games (previewed), players see it on Episode 6, the
//      shared stats and couch B don't; Drop the ruling puts the correction back.
//   6. jordan takes his answer back; riley can't (it touched games she doesn't run). The never-reviewed result was
//      never shown, counted or applied, and no real season has a pending result with a status.
//   7. Screens at --width: Backstage › Results (who can fill them in, filled in by, the disputed card, corrections,
//      flags), the episode page's plate and ruling, the Episodes row, the Cast tab's "1 source" and its flag. Nothing
//      wider than the screen; no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-community.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only (reads real seasons' counts
// once, writing nothing); refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-community runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-community.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const OUT6 = "Cristian Chavez";
const quickAnswer = (left, sources = 2) =>
  "Here's what I found:\n```json\n" +
  JSON.stringify({ found: true, episodeTitle: null, left, headline: "A blindside at Tribal.", sources: Array.from({ length: sources }, (_, i) => `https://news${i}.example/ep6`) }) +
  "\n```";

// A full answer from the prompt's own skeleton: everyone answered (high confidence), who went home, and what each
// source says happened. `eric` and `devin` vary between the sources; Devin's idol is only ever medium confidence.
function fullAnswer(prompt, { danny = true, eric = true, devin = true } = {}) {
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
  if (danny) Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  if (eric) Object.assign(who("Eric Macksoud"), { wonIndividualReward: "yes" });
  if (devin) Object.assign(who("Devin Way"), { foundAdvantage: "yes", advantageFoundName: "hidden immunity idol", confidence: "medium" });
  return JSON.stringify(a);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const A = `?couch=${fx.couchId}`;
    const B = `?couch=${fx.extraCouchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
    // Staged before 6b and never reviewed: never carried over.
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, confidence)
       VALUES ($1, 6, 'event', 'Sharonda Cox', '', 'idolFound', 'pending', true, 'high')`,
      [sid]
    );

    const ep6 = async (key) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]]);
      const ep = rows[0].state.episodes.find((e) => e.number === 6) || { events: [], scoringEvents: [] };
      const name = new Map(rows[0].state.castaways.map((c) => [c.id, c.name]));
      return {
        outs: ep.events.length,
        events: (ep.scoringEvents || []).map((e) => `${name.get(e.castawayId)}:${e.type}`),
        stage: ep.resultsStage || null,
      };
    };
    const has = (e, what) => e.events.includes(what);
    const fact = async (name, type = "") =>
      (await pool.query("SELECT id, status, fact_status FROM season_decisions WHERE season_id = $1 AND episode_number = 6 AND castaway_name = $2 AND event_type = $3", [sid, name, type])).rows[0] ?? null;
    const flagsOf = async (id) => (await pool.query("SELECT status FROM fact_disputes WHERE decision_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.status);
    const lines = async (key, kind) => (await pool.query("SELECT * FROM league_changes WHERE league_id = $1 AND kind = $2 ORDER BY created_at", [L[key], kind])).rows;

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });

    // ---- 1. who went home, for every couch on the season ----
    check((await as.sam.call("POST", `/api/seasons/${sid}/disputes${A}`, { episode: 5, reason: "missing", note: "x" })).status === 403, "sam (on Episode 3) can't flag Episode 5");
    const quick = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${A}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: OUT6, how: "voted out" }]) });
    check(quick.status === 200 && quick.body.applied?.games === 3, "alex's quick check applies to couch A's three games", JSON.stringify(quick.body));
    const subs = (await pool.query(`SELECT source, submitted_by, couch_id, covers FROM episode_research er JOIN shows s ON s.id = er.show_id WHERE s.slug = 'zt-nd-survivor' AND source <> 'combined'`)).rows;
    check(subs.length === 1 && subs[0].source === "quick" && subs[0].submitted_by === fx.users.alex && subs[0].couch_id === fx.couchId && subs[0].covers.kinds.join() === "elimination", "a submission of its own: who went home, by alex, from couch A", JSON.stringify(subs));
    const e1 = await Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    check(e1.every((e) => e.outs === 1 && e.stage === "early"), "every league on the season has who went home, early (couch B's too)", JSON.stringify(e1));
    check((await lines("lineup", "results.quick")).length === 1 && (await lines("extra", "results.quick")).length === 0, "only couch A's games get its line in Recent changes");
    // The result nobody reviewed, while it's still there: never waiting for anyone, never in a game or the stats.
    const bs0 = (await as.alex.call("GET", `/api/seasons/${sid}/backstage${A}&episode=6&show=1`)).body;
    check(bs0.episode.waiting === 0 && !bs0.needs.some((x) => x.id === "waiting"), "the result nobody reviewed doesn't wait for anyone", JSON.stringify(bs0.needs));
    check(e1.every((e) => !has(e, "Sharonda Cox:idolFound")), "nor reach a game");

    // ---- 2. anyone fills in ----
    const fillOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/episodes${A}`)).body.fill;
    check(!(await fillOf("jordan")), "jordan hasn't seen Episode 6: no Fill it in yet");
    await as.jordan.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.couchId });
    check((await fillOf("jordan"))?.episode === 6, "jordan, having seen Episode 6's early results: Full scores need one paste");
    check(!(await fillOf("sam")) && !(await fillOf("alex")), "not sam (on Episode 3), not alex (he runs the games: Backstage)");
    check((await as.sam.call("GET", `/api/seasons/${sid}/backstage/prompt${A}&episode=6&kind=full`)).status === 403, "sam can't fill in an episode he hasn't seen");
    check((await as.jordan.call("GET", `/api/seasons/${sid}/backstage/prompt${A}&episode=6&kind=quick`)).status === 403, "who went home stays with whoever runs the games");
    const off = await as.alex.call("PUT", `/api/seasons/${sid}/backstage/fill${A}`, { anyone: false });
    check(off.status === 200 && !(await fillOf("jordan")) && (await as.jordan.call("GET", `/api/seasons/${sid}/backstage/prompt${A}&episode=6&kind=full`)).status === 403, "Only people who run games: jordan can't fill in");
    check((await as.jordan.call("PUT", `/api/seasons/${sid}/backstage/fill${A}`, { anyone: true })).status === 403, "a player can't change who fills in");
    await as.alex.call("PUT", `/api/seasons/${sid}/backstage/fill${A}`, { anyone: true });
    check((await fillOf("jordan"))?.episode === 6, "Anyone on the couch again");

    // The browser: jordan fills it in from Tonight.
    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    const ui = (b) => {
      const failed = [];
      b.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(b.BASE, "")}`));
      return failed;
    };
    const jFailed = ui(j);
    await j.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: j.BASE });
    for (const b of [j]) {
      await b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
    }
    let n = 0;
    const shot = async (page, name) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const fits = async (page, where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (page, re) => {
      try {
        await page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await page.locator("[role=status]").textContent().catch(() => "")) || "").trim();
    };

    await j.page.goto(`${j.BASE}/show/${sid}/tonight`);
    await j.page.locator("[data-fill-it='6']").waitFor({ timeout: 20000 });
    await fits(j.page, "Tonight with Fill it in");
    await shot(j.page, "tonight-fill-it");
    await j.page.locator("[data-fill-it='6']").click();
    await j.page.locator("[data-ask-ai=full]").waitFor();
    await j.page.locator("a[data-ai-open][href]").waitFor({ timeout: 20000 });
    const jPrompt = (await as.jordan.call("GET", `/api/seasons/${sid}/backstage/prompt${A}&episode=6&kind=full`)).body.prompt;
    check(/Cristian Chavez/.test(jPrompt) && /Danny Kilby/.test(jPrompt), "jordan's question asks about everyone still in");
    await j.page.locator("[data-ai-copy]").click();
    await j.page.locator("[data-ai-answer]").fill(fullAnswer(jPrompt));
    await j.page.locator("[data-ai-check=ok]").waitFor();
    await shot(j.page, "fill-it-pasted");
    await j.page.locator("[data-ai-use]").click();
    const thanks = await toasted(j.page, /Thanks/);
    check(/Thanks! Every game on the couch is scored/.test(thanks), "jordan's paste: every game on the couch scored", thanks);
    const e2 = await Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    check(e2.every((e) => has(e, "Danny Kilby:individualImmunity") && has(e, "Eric Macksoud:rewardWin") && !has(e, "Devin Way:idolFound") && e.stage === null), "trusted results reached every league (final); Devin's medium idol waits", JSON.stringify(e2));
    const jSub = (await pool.query(`SELECT id, submitted_by, couch_id, covers FROM episode_research WHERE source = 'paste' AND submitted_by = $1`, [fx.users.jordan])).rows;
    check(jSub.length === 1 && jSub[0].couch_id === fx.couchId && jSub[0].covers.kinds === null && jSub[0].covers.people.length >= 13, "jordan's answer is its own row, from couch A, covering everyone");
    check((await fact(OUT6))?.fact_status === "confirmed", "who went home: confirmed (alex's quick check and jordan's answer agree)");
    check((await fact("Danny Kilby", "individualImmunity"))?.fact_status === "reported" && (await fact("Devin Way", "idolFound"))?.status === "pending", "Danny's immunity: reported (1 source); Devin's idol waits");
    const jLine = (await lines("lineup", "results.full"))[0];
    check(jLine?.user_id === fx.users.jordan && /on their own \(3\)/.test(jLine.text), "couch A's line: jordan's, three results", jLine?.text);
    const jView = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${A}`)).body.lines.find((l) => l.batch === jLine?.batch);
    const sView = (await as.sam.call("GET", `/api/seasons/${sid}/changes${A}`)).body.lines.find((l) => l.batch === jLine?.batch);
    check(jView?.undoable === true && sView?.undoable === false, "the answer is jordan's to undo, not sam's");
    const bs = (await as.alex.call("GET", `/api/seasons/${sid}/backstage${A}&episode=6&show=1`)).body;
    check(bs.episode.waiting === 1 && bs.shown.waiting.length === 1 && bs.shown.waiting[0].name === "Devin Way", "Backstage waits on Devin's idol only (never the result nobody reviewed)", JSON.stringify(bs.shown?.waiting?.map((w) => w.name)));
    const filled = bs.fill.episodes.find((e) => e.episode === 6);
    check(bs.fill.anyone === true && filled?.by === "zt_nd_jordan" && filled.here && filled.sources === 1, "Backstage: Episode 6 filled in by jordan, 1 source so far", JSON.stringify(filled));
    const stats1 = (await as.jordan.call("GET", `/api/seasons/${sid}/stats${A}`)).body;
    check(stats1.unsure?.[6]?.["Danny Kilby"] === "reported" && !stats1.unsure?.[6]?.[OUT6], "stats: Danny's Episode 6 is marked 1 source; Cristian's isn't (confirmed)", JSON.stringify(stats1.unsure?.[6]));

    // ---- 3. "Something wrong?" ----
    await j.page.goto(`${j.BASE}/show/${sid}/episodes?page=ep6`);
    await j.page.locator("[data-something-wrong]").waitFor({ timeout: 20000 });
    await j.page.locator("[data-something-wrong]").scrollIntoViewIfNeeded();
    await shot(j.page, "episode-foot");
    await j.page.locator("[data-something-wrong]").click();
    await j.page.locator("[data-dispute-who='Eric Macksoud']").waitFor();
    check((await j.page.locator("[data-dispute-who]").count()) >= 4, "who is it about: everyone with a result, and Something else");
    await shot(j.page, "dispute-who");
    await j.page.locator("[data-dispute-who='Eric Macksoud']").click();
    await j.page.locator("[data-dispute=what]").waitFor();
    const whatText = (await j.page.locator("[data-dispute=what]").innerText()).toLowerCase();
    check(whatText.includes("reward") && whatText.includes("1 source"), "which result: Eric's reward, 1 source", whatText.slice(0, 120));
    await shot(j.page, "dispute-what");
    await j.page.locator("[data-dispute-what]").first().click();
    await j.page.locator("[data-dispute=why]").waitFor();
    check(await j.page.locator("[data-dispute-send]").isDisabled(), "Send waits for why");
    await j.page.locator("[data-reason='didnt-happen']").click();
    await j.page.locator("[data-dispute-note]").fill("Eric sat out the reward; it was Kristin's");
    await fits(j.page, "the dispute sheet");
    await shot(j.page, "dispute-why");
    await j.page.locator("[data-dispute-send]").click();
    check(/Sent/.test(await toasted(j.page, /Sent/)), "jordan's flag is sent");
    const ericId = (await fact("Eric Macksoud", "rewardWin")).id;
    const dannyId = (await fact("Danny Kilby", "individualImmunity")).id;
    check((await flagsOf(ericId)).join() === "open" && (await fact("Eric Macksoud", "rewardWin")).fact_status === "disputed", "Eric's reward: disputed");
    check(has(await ep6("lineup"), "Eric Macksoud:rewardWin"), "nothing changes in the games until it's settled");
    // riley and alex have watched it too: they can flag it, and Backstage names what was flagged.
    for (const who of ["riley", "alex"]) await as[who].call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.couchId });
    const rFlag = await as.riley.call("POST", `/api/seasons/${sid}/disputes${A}`, { episode: 6, decisionId: dannyId, reason: "wrong-person" });
    check(rFlag.status === 200 && rFlag.body.others === 0, "riley flags Danny's immunity");
    const again = await as.jordan.call("POST", `/api/seasons/${sid}/disputes${A}`, { episode: 6, decisionId: ericId, reason: "didnt-happen", note: "again" });
    check(again.status === 200 && (await flagsOf(ericId)).length === 1, "flagging the same result twice is one flag");
    const bs2 = (await as.alex.call("GET", `/api/seasons/${sid}/backstage${A}&episode=6`)).body;
    check(bs2.needs.some((x) => x.id === "question" && x.episode === 6) && bs2.episode.questions >= 2, "Backstage: results in Episode 6 are disputed, one more answer settles them", JSON.stringify(bs2.needs));
    check(bs2.flags.length === 2 && bs2.flags.some((f) => f.who === "zt_nd_jordan" && /Eric Macksoud/.test(f.what)), "Flags from your couch: jordan's and riley's", JSON.stringify(bs2.flags));
    const res6 = (await as.jordan.call("GET", `/api/seasons/${sid}/results/6${A}`)).body;
    const eric6 = res6.people.find((p) => p.name === "Eric Macksoud")?.results[0];
    check(eric6?.yours && eric6.line === "Disputed", "the episode's results: Eric's reward, disputed, your flag", JSON.stringify(eric6));
    check((await as.sam.call("GET", `/api/seasons/${sid}/results/6${A}`)).status === 403, "sam can't read Episode 6's results");

    // ---- 4. couch B checks it ----
    await as.casey.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch: fx.extraCouchId });
    const cPrompt = (await as.casey.call("GET", `/api/seasons/${sid}/backstage/prompt${B}&episode=6&kind=full`)).body.prompt;
    const cPaste = await as.casey.call("POST", `/api/seasons/${sid}/backstage/results${B}`, { episode: 6, kind: "full", answer: fullAnswer(cPrompt, { eric: false, devin: false }) });
    check(cPaste.status === 200, "casey fills it in from couch B", JSON.stringify(cPaste.body).slice(0, 200));
    check((await fact("Danny Kilby", "individualImmunity")).fact_status === "confirmed" && (await flagsOf(dannyId)).join() === "kept", "Danny's immunity stands: confirmed, riley's flag kept");
    const ericNow = await fact("Eric Macksoud", "rewardWin");
    check(ericNow.fact_status === "removed" && ericNow.status === "rejected" && (await flagsOf(ericId)).join() === "upheld", "Eric's reward comes out: jordan's flag upheld");
    const devin = await fact("Devin Way", "idolFound");
    check(devin.fact_status === "disputed" && devin.status === "pending", "Devin's idol: the sources split, it stays out");
    const e3 = await Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    check(e3.every((e) => !has(e, "Eric Macksoud:rewardWin") && has(e, "Danny Kilby:individualImmunity")), "the correction reached every league", JSON.stringify(e3));
    const corr = await lines("lineup", "results.correction");
    check(corr.length === 1 && corr[0].text === "Episode 6 corrected" && corr[0].detail.facts[0].name === "Eric Macksoud" && corr[0].detail.facts[0].change === "removed", "a correction line in the game, naming nobody in its text", JSON.stringify(corr.map((c) => c.text)));
    check((await lines("extra", "results.correction")).length === 1, "and in couch B's game");
    const eps = (await as.jordan.call("GET", `/api/seasons/${sid}/episodes${A}`)).body;
    check(eps.corrections.length === 1 && eps.corrections[0].episode === 6 && eps.corrections[0].change === "removed", "Episodes: Episode 6 corrected", JSON.stringify(eps.corrections));
    const bs3 = (await as.alex.call("GET", `/api/seasons/${sid}/backstage${A}&episode=6`)).body;
    check(bs3.fill.episodes.find((e) => e.episode === 6)?.sources === 2, "Backstage: Episode 6 now has 2 sources");
    check(bs3.flags.find((f) => f.who === "zt_nd_jordan")?.status === "upheld" && bs3.corrections[0]?.decisionId === ericId, "Backstage: jordan's flag upheld, and the correction to keep or not");

    // ---- 5. a house ruling ----
    const pv = await as.alex.call("POST", `/api/seasons/${sid}/backstage/rulings${A}`, { decisionId: ericId, preview: true });
    check(pv.status === 200 && pv.body.games === 3 && Array.isArray(pv.body.lines), "keeping the old result: previewed for couch A's three games", JSON.stringify(pv.body).slice(0, 200));
    check((await as.riley.call("POST", `/api/seasons/${sid}/backstage/rulings${A}`, { decisionId: ericId, preview: true })).body.games === 1, "riley's ruling would cover only the game she runs");
    check((await as.jordan.call("POST", `/api/seasons/${sid}/backstage/rulings${A}`, { decisionId: ericId })).status === 403, "a player can't make a ruling");

    // The browser: alex keeps it from Backstage › Results.
    const a = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(a.close);
    const aFailed = ui(a);
    await a.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    await a.page.goto(`${a.BASE}/show/${sid}/backstage/results?ep=6`);
    await a.page.locator("[data-correction]").waitFor({ timeout: 20000 });
    await a.page.locator("[data-fill-state]").scrollIntoViewIfNeeded();
    check((await a.page.locator("[data-filled='6']").innerText()).includes("2 sources agree"), "Results: Episode 6 filled in, 2 sources agree");
    check((await a.page.locator("[data-question='6']").count()) === 1, "Results: the disputed card asks to check it again");
    await shot(a.page, "results-fill-state");
    await a.page.locator("[data-correction]").scrollIntoViewIfNeeded();
    await fits(a.page, "Backstage › Results");
    await shot(a.page, "results-corrections");
    await a.page.locator("[data-keep-old]").click();
    await a.page.locator("[data-guard='2']").waitFor();
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor();
    check((await a.page.locator("[data-guard='2']").innerText()).includes("See the ruling on Episode 6"), "the ruling's preview: your players see it on Episode 6");
    await shot(a.page, "keep-old-result");
    await a.page.locator("[data-guard-confirm]").click();
    check(/House ruling saved/.test(await toasted(a.page, /House ruling saved/)), "House ruling saved");
    await a.page.locator("[data-ruling]").waitFor();
    await shot(a.page, "ruling");
    const rulings = (await pool.query("SELECT league_id FROM league_rulings WHERE decision_id = $1", [ericId])).rows.map((r) => r.league_id);
    check(rulings.length === 3 && !rulings.includes(L.extra), "linked games rule together: couch A's three, not couch B's");
    check(has(await ep6("lineup"), "Eric Macksoud:rewardWin") && !has(await ep6("extra"), "Eric Macksoud:rewardWin"), "Eric's reward counts in couch A's games again, not in couch B's");
    check((await fact("Eric Macksoud", "rewardWin")).status === "rejected", "the shared fact stays corrected");
    const stats2 = (await as.alex.call("GET", `/api/seasons/${sid}/stats${A}`)).body;
    const ericStat = stats2.cast?.find((c) => c.name === "Eric Macksoud");
    check(ericStat && !ericStat.events.some(([e, k]) => e === 6 && k === "rewardWin"), "the shared stats never count the ruling");
    const res6b = (await as.jordan.call("GET", `/api/seasons/${sid}/results/6${A}`)).body;
    check(res6b.rulings.length === 3 && res6b.corrections[0]?.ruling?.by === "zt_nd_alex", "players see the ruling on Episode 6", JSON.stringify(res6b.rulings).slice(0, 200));

    await j.page.goto(`${j.BASE}/show/${sid}/episodes`);
    await j.page.locator("[data-correction-row='6']").waitFor({ timeout: 20000 });
    check((await j.page.locator("[data-correction-row='6']").innerText()).toLowerCase().includes("house ruling"), "Episodes: Episode 6 corrected · house ruling");
    await shot(j.page, "episodes-correction");
    await j.page.locator("[data-correction-row='6']").click();
    await j.page.locator("[data-house-ruling]").waitFor();
    await fits(j.page, "the episode page");
    await shot(j.page, "episode-ruling");

    await a.page.locator("[data-drop-ruling]").click();
    check(/Ruling dropped/.test(await toasted(a.page, /Ruling dropped/)), "Drop the ruling");
    await a.page.locator("[data-keep-old]").waitFor();
    check(!has(await ep6("lineup"), "Eric Macksoud:rewardWin") && (await pool.query("SELECT 1 FROM league_rulings WHERE decision_id = $1", [ericId])).rowCount === 0, "the correction applies in couch A's games again");

    // Who can fill them in, from Backstage (with the toast's Undo).
    await a.page.locator("[data-who-fills]").click();
    await a.page.locator("[data-anyone='false']").click();
    await toasted(a.page, /Only people who run games/);
    check((await pool.query("SELECT results_by_anyone FROM couches WHERE id = $1", [fx.couchId])).rows[0].results_by_anyone === false, "Who can fill them in: only people who run games");
    await a.page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await a.page.waitForTimeout(800);
    check((await pool.query("SELECT results_by_anyone FROM couches WHERE id = $1", [fx.couchId])).rows[0].results_by_anyone === true, "and Undo puts Anyone on the couch back");

    // ---- 6. taking an answer back ----
    check((await as.riley.call("POST", `/api/seasons/${sid}/changes/${jLine.batch}/undo${A}`)).status === 403, "riley can't take back jordan's answer (games she doesn't run)");
    const undo = await as.jordan.call("POST", `/api/seasons/${sid}/changes/${jLine.batch}/undo${A}`);
    check(undo.status === 200, "jordan takes his answer back", JSON.stringify(undo.body));
    check((await fact("Danny Kilby", "individualImmunity")).fact_status === "reported" && (await fact("Devin Way", "idolFound")).fact_status === "removed", "Danny's immunity stands on casey's alone; Devin's idol has nothing left");
    check(has(await ep6("lineup"), "Danny Kilby:individualImmunity") && (await fact(OUT6)).fact_status === "confirmed", "the games keep what other answers still say");
    // A newer answer for the episode withdraws a staged result it doesn't report (classic's restaging): either way it
    // was never carried over.
    const sharonda = await fact("Sharonda Cox", "idolFound");
    check(!sharonda || (sharonda.status === "pending" && sharonda.fact_status === null), "the result nobody reviewed never got a status", JSON.stringify(sharonda));
    const anywhere = await Promise.all(["outlast", "lineup", "pool", "extra"].map(ep6));
    check(anywhere.every((e) => !has(e, "Sharonda Cox:idolFound")), "and it never reached a game");
    const statsS = (await as.alex.call("GET", `/api/seasons/${sid}/stats${A}`)).body.cast.find((c) => c.name === "Sharonda Cox");
    check(!statsS?.events.some(([e, k]) => e === 6 && k === "idolFound"), "or the stats");
    const real = (await pool.query(
      `SELECT count(*)::int AS n FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
        WHERE s.slug NOT LIKE 'zt-%' AND d.status = 'pending' AND d.fact_status IS NOT NULL`
    )).rows[0].n;
    check(real === 0, "no real season's pending results were given a status (never carried over)", `${real}`);

    // ---- 7. the Cast tab: 1 source, and its flag ----
    await j.page.goto(`${j.BASE}/show/${sid}/cast`);
    await j.page.locator("[data-cast='Danny']").first().waitFor({ timeout: 20000 });
    await j.page.locator("[data-cast='Danny']").first().click();
    await j.page.locator("[data-story]").waitFor();
    await j.page.locator("[data-story-ep='6'] [data-unsure]").waitFor({ timeout: 10000 }).catch(() => {});
    check((await j.page.locator("[data-story-ep='6'] [data-unsure='reported']").count()) === 1, "Danny's story: Episode 6 marked 1 source");
    await fits(j.page, "the castaway's story");
    await shot(j.page, "story-1-source");
    await j.page.locator("[data-story-flag='6']").click();
    await j.page.locator("[data-dispute=what]").waitFor();
    check((await j.page.locator("[data-dispute=what]").innerText()).toLowerCase().includes("immunity"), "its flag opens Something wrong at Danny's results");
    await shot(j.page, "story-flag");

    for (const [who, b, list] of [["jordan", j, jFailed], ["alex", a, aFailed]]) {
      const errs = b.errors.filter((e) => !/Failed to load resource/.test(e));
      check(!errs.length && !list.length, `no page errors (${who})`, [...errs, ...list].join(" | "));
    }
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
