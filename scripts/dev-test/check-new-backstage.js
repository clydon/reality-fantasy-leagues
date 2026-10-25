// Dev-only check for Backstage I (docs/PLAN-new-design.md step 5), against the dev server, on new-fixture.js (three
// linked leagues on a zt Survivor 51, results through Episode 5; the season is moved back five days here so Episode 6
// has aired with nothing in):
//   1. In a browser at --width as alex (runs all three games): the show's ⋯ menu has Backstage's dot; Backstage's
//      Needs you asks who went home in Episode 6; Results' quick check through the Ask an AI sheet (the ChatGPT link to
//      a parked question, Another AI? Copy the question, the paste and its check) applies on its own to all three
//      games (early results) and shows no name until Show me; Undo from Recent changes takes it off again; entering who
//      went home yourself goes through the tier-2 preview; the full results' paste applies what's trusted and leaves
//      the medium-confidence result waiting; ticking it previews and applies it (final).
//   2. The API: a player (sam) is refused Backstage and reads Recent changes with nothing to undo; riley (Game admin of
//      one game) gets only that game and can't undo a change to all three; someone off the couch (casey) gets 404;
//      the quick check that isn't sure (one source, a name we don't know) waits and applies nothing; no line names
//      who went home; undo goes newest first (a later change to the episode first) and puts each league's stage back.
//   3. Classic's writes log too: a settings change and a role change (tier 1) undone from Recent changes, and who
//      went home entered in classic with its undo; a player's own lineup isn't logged.
//   4. Players: sam's Backstage says it's for whoever runs a game; his Recent changes has no Undo; riley's ⋯ menu has
//      Recent changes. Nothing wider than the screen; no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-backstage.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-backstage runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-backstage.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// Who went home in Episode 6 (the fixture's cast leaves in order: the sixth face goes in the sixth episode).
const OUT6 = "Cristian Chavez";
const quickAnswer = (left, sources = 2) =>
  "Here's what I found:\n```json\n" +
  JSON.stringify({ found: true, episodeTitle: null, left, headline: "A blindside at Tribal.", sources: Array.from({ length: sources }, (_, i) => `https://news${i}.example/ep6`) }) +
  "\n```";

// The full answer: the prompt's own skeleton, everyone answered with high confidence, and four things that happened.
// Devin's idol only at medium confidence: that one waits.
function fullAnswer(prompt) {
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
  Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  Object.assign(who("Eric Macksoud"), { wonIndividualReward: "yes" });
  Object.assign(who("Devin Way"), { foundAdvantage: "yes", advantageFoundName: "hidden immunity idol", confidence: "medium" });
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
    const q = `?couch=${fx.couchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [
      [fx.users.alex, fx.users.riley, fx.users.sam],
    ]);
    // Episode 6 aired two days ago, with nothing in.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);

    const ep6 = async (key) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]]);
      const ep = rows[0].state.episodes.find((e) => e.number === 6) || { events: [], scoringEvents: [] };
      return { outs: ep.events.length, events: (ep.scoringEvents || []).length, stage: ep.resultsStage || null };
    };
    const allEp6 = async () => Promise.all(["outlast", "lineup", "pool"].map(ep6));
    const changes = async () => (await pool.query("SELECT * FROM league_changes WHERE league_id = ANY($1::uuid[]) ORDER BY created_at", [Object.values(L)])).rows;

    const as = {};
    for (const who of ["alex", "riley", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });

    // ---- 2a. who may see Backstage ----
    const bsAlex = await as.alex.call("GET", `/api/seasons/${sid}/backstage${q}`);
    check(bsAlex.status === 200 && bsAlex.body.games.length === 3, "alex runs all three games here", JSON.stringify(bsAlex.body).slice(0, 200));
    check(bsAlex.body.episode?.number === 6 && bsAlex.body.episode.stage === "none", "Episode 6 is open with nothing in");
    check(bsAlex.body.needs?.[0]?.id === "quick" && /Episode 6/.test(bsAlex.body.needs[0].title), "Needs you: who went home in Episode 6");
    const bsRiley = await as.riley.call("GET", `/api/seasons/${sid}/backstage${q}`);
    check(bsRiley.status === 200 && bsRiley.body.games.map((g) => g.name).join() === "Lineup League", "riley (Game admin) gets only the game she runs");
    check((await as.sam.call("GET", `/api/seasons/${sid}/backstage${q}`)).status === 403, "a player is refused Backstage");
    check((await as.casey.call("GET", `/api/seasons/${sid}/backstage${q}`)).status === 404, "someone off the couch gets 404");
    const quickQ = await as.alex.call("GET", `/api/seasons/${sid}/backstage/prompt${q}&episode=6&kind=quick`);
    check(/episode 6/.test(quickQ.body.prompt || "") && quickQ.body.prompt.includes(OUT6) && !quickQ.body.prompt.includes("Aaliyah Puglia"), "the quick question names only who's still in");

    // ---- 2b. a quick check that isn't sure waits ----
    const unsure = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: OUT6, how: "Voted Out" }], 1) });
    check(unsure.status === 200 && !unsure.body.applied && unsure.body.waiting?.doubt === "one-source", "one source: it waits", JSON.stringify(unsure.body));
    const stranger = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${q}`, { episode: 6, kind: "quick", answer: quickAnswer([{ name: "Someone Else", how: "Voted Out" }]) });
    check(stranger.body.waiting?.doubt === "unknown-name", "a name we don't know: it waits");
    check((await allEp6()).every((e) => !e.outs && !e.stage), "nothing applied while it waits");

    // ---- 1. the browser ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    // A request that fails says which (the console's "Failed to load resource" doesn't). Chrome's own /favicon.ico
    // fetch, now and then mid-flow, isn't the app's (its icons are icon1.png and friends), so it doesn't count.
    const failed = [];
    let favicon = 0;
    page.on("response", (res) => res.status() >= 400 && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    page.on("console", (m) => {
      if (m.type() !== "error" || !m.location()?.url) return;
      if (m.location().url.endsWith("/favicon.ico")) favicon++;
      else failed.push(`at ${m.location().url.replace(BASE, "")} on ${page.url().replace(BASE, "")}`);
    });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    let n = 0;
    const shot = async (name) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const toasted = async (re) => {
      try {
        await page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
        return (await page.locator("[role=status]").textContent()).trim();
      } catch {
        return (await page.locator("[role=status]").textContent().catch(() => "")) || "";
      }
    };
    const visibleText = () => page.evaluate(() => document.body.innerText);
    const sheet = page.locator("[role=dialog]");

    await page.goto(`${BASE}/show/${sid}/tonight`);
    await page.locator("[data-menu-dot]").waitFor({ timeout: 20000 });
    check(true, "the ⋯ menu carries Backstage's dot");
    await page.getByRole("button", { name: /Show menu/ }).click();
    await sheet.getByText("Who went home in Episode 6?").waitFor();
    check(await sheet.getByText("Recent changes").isVisible(), "the ⋯ menu: Backstage says what needs you, and Recent changes is there");
    await shot("menu");
    await page.goto(`${BASE}/show/${sid}/backstage`);
    await page.locator("[data-job=quick]").waitFor();
    check((await page.locator("[data-job]").count()) === 1, "Backstage › Needs you: one job");
    await fits("Backstage");
    await shot("backstage");

    await page.locator("[data-job=quick]").click();
    await page.locator("[data-quick=ask]").waitFor();
    check(page.url().includes("/backstage/results?ep=6"), "the job opens Results at Episode 6");
    await shot("results-ask");
    await page.locator("[data-ask=quick]").click();
    await page.locator("[data-ask-ai=quick]").waitFor();
    await page.locator('a[data-ai-open][href*="chatgpt.com"]').waitFor({ timeout: 20000 });
    const href = await page.locator("a[data-ai-open]").getAttribute("href");
    check(/chatgpt\.com\/\?hints=search&q=/.test(href) && decodeURIComponent(href).includes("/b/"), "Open in ChatGPT carries a link to the parked question");
    await fits("the Ask an AI sheet");
    await shot("ask-ai");
    await sheet.getByRole("button", { name: "Use Grok instead" }).click();
    check(/grok\.com\/\?q=/.test((await page.locator("a[data-ai-open]").getAttribute("href")) || ""), "Use Grok instead");
    await page.locator("[data-ai-copy]").click();
    await page.locator("[data-ai-answer]").waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    check(/Who left the game in this episode/.test(copied), "Another AI? copies the question");
    await page.locator("[data-ai-answer]").fill("not the answer");
    check((await page.locator("[data-ai-check=bad]").count()) === 1 && (await page.locator("[data-ai-use]").isDisabled()), "a paste that isn't the answer can't be used");
    await page.evaluate((t) => navigator.clipboard.writeText(t), quickAnswer([{ name: OUT6, how: "Voted Out" }]));
    await sheet.getByRole("button", { name: "Paste the answer" }).click();
    await page.locator("[data-ai-check=ok]").waitFor();
    await shot("ask-ai-pasted");
    await page.locator("[data-ai-use]").click();
    const applied = await toasted(/Applied to 3 games/);
    check(/Applied to 3 games · nothing shown to you/.test(applied), "the quick check applies on its own to all three games", applied);
    await page.locator("[data-quick=own]").waitFor();
    check((await page.locator("[data-hidden-face]").count()) === 1 && !(await visibleText()).includes(OUT6), "Results: applied on its own, nobody named");
    const e1 = await allEp6();
    check(e1.every((e) => e.outs === 1 && e.stage === "early"), "every league: who went home is in, early results", JSON.stringify(e1));
    let rows = await changes();
    check(rows.length === 3 && new Set(rows.map((r) => r.batch)).size === 1 && rows.every((r) => r.kind === "results.quick" && r.user_id === fx.users.alex && r.tier === 2), "one batch in Recent changes, a row per game");
    check(rows.every((r) => !r.text.includes(OUT6) && !r.text.includes("Cristian")), "the line names nobody", rows[0]?.text);
    await shot("results-own");
    await page.locator("[data-quick=own] [data-show-me]").click();
    await page.getByText(OUT6).first().waitFor();
    check(true, "Show me names who went home");
    await fits("Results");
    await shot("results-shown");

    // Players can reveal it now.
    const eps = await as.riley.call("GET", `/api/seasons/${sid}/episodes${q}`);
    check(eps.body.reveal?.episode === 6 && eps.body.reveal?.stage === "early", "riley has Episode 6's early results to reveal", JSON.stringify(eps.body.reveal));

    // Recent changes: undo it.
    await page.goto(`${BASE}/show/${sid}/backstage/history`);
    await page.locator("[data-change='results.quick'] [data-undo]").waitFor();
    await shot("changes");
    await page.locator("[data-change='results.quick'] [data-undo]").click();
    check(/Undone/.test(await toasted(/Undone/)), "Undo from Recent changes");
    await page.getByText(/Undone by/).waitFor();
    const e2 = await allEp6();
    check(e2.every((e) => !e.outs && !e.stage), "every league is back to nothing in", JSON.stringify(e2));
    await shot("changes-undone");

    // Entering who went home yourself: the tier-2 preview first.
    await page.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
    await page.locator("[data-by-hand]").click();
    await page.locator("[data-by-hand-sheet]").waitFor();
    await page.locator(`[data-out="${OUT6}"]`).click();
    await shot("by-hand");
    await sheet.getByRole("button", { name: "See what changes" }).click();
    await page.locator("[data-guard='2']").waitFor();
    await page.locator("[data-guard-confirm]:not([disabled])").waitFor();
    const lines = await page.locator("[data-guard='2']").innerText();
    check(lines.includes(`${OUT6} out`), "the preview: who goes out, and whose team loses them", lines.slice(0, 200));
    await fits("the preview sheet");
    await shot("guard");
    await page.locator("[data-guard-confirm]").click();
    check(/Applied to 3 games/.test(await toasted(/Applied to 3 games/)), "applied after the preview");
    await page.locator("[data-quick=in]").waitFor();
    check((await allEp6()).every((e) => e.outs === 1 && e.stage === "early"), "every league: early results, entered by hand");

    // The full results: what's trusted applies on its own, Devin's medium-confidence idol waits.
    await page.locator("[data-ask=full]").click();
    await page.locator("[data-ask-ai=full]").waitFor();
    await page.locator("a[data-ai-open][href]").waitFor({ timeout: 20000 });
    const fullQ = await as.alex.call("GET", `/api/seasons/${sid}/backstage/prompt${q}&episode=6&kind=full`);
    await page.locator("[data-ai-copy]").click();
    await page.locator("[data-ai-answer]").fill(fullAnswer(fullQ.body.prompt));
    await page.locator("[data-ai-check=ok]").waitFor();
    await page.locator("[data-ai-use]").click();
    const fullToast = await toasted(/applied to 3 games/);
    check(/results? applied to 3 games · 1 waits for you/.test(fullToast), "the full results: trusted ones applied, one waits", fullToast);
    await page.locator("[data-waiting='1']").waitFor();
    const e3 = await allEp6();
    check(e3[1].events >= 2 && e3.every((e) => e.stage === null), "every league is final, Weekly Lineup has the scoring moments", JSON.stringify(e3));
    check(!(await visibleText()).includes("Devin"), "what waits isn't named until Show me");
    await shot("results-waiting");
    await page.locator("[data-waiting] [data-show-me]").click();
    await page.locator("[data-tick]").first().waitFor();
    check((await page.locator("[data-tick]").count()) === 1 && (await page.locator("[data-tick]").innerText()).includes("Devin Way"), "Show me: Devin's idol, to tick");
    await page.locator("[data-tick]").first().click();
    await shot("results-ticked");
    await page.locator("[data-apply-waiting]").click();
    await page.locator("[data-guard-confirm]:not([disabled])").waitFor();
    await shot("guard-full");
    await page.locator("[data-guard-confirm]").click();
    check(/Applied to 3 games/.test(await toasted(/Applied to 3 games/)), "the ticked result applied");
    await page.locator("[data-full=final]").waitFor();
    const e4 = await allEp6();
    check(e4[1].events === e3[1].events + 1, "Weekly Lineup gained the idol", `${e3[1].events} → ${e4[1].events}`);
    const bs4 = await as.alex.call("GET", `/api/seasons/${sid}/backstage${q}&episode=6`);
    check(bs4.body.episode.waiting === 0 && bs4.body.episode.stage === "final" && !bs4.body.needs.length, "nothing waits; Needs you is clear");
    await shot("results-final");
    await page.goto(`${BASE}/show/${sid}/backstage`);
    await page.locator("[data-all-clear]").waitFor();
    check((await page.locator("[data-menu-dot]").count()) === 0, "all caught up, and no dot");
    await shot("backstage-clear");

    // ---- 2c. undo goes newest first ----
    rows = await changes();
    const batches = [...new Map(rows.map((r) => [r.batch, r])).values()];
    const quickBatch = batches.filter((r) => r.kind === "results.quick" && !r.undone_at).pop();
    const fullBatches = batches.filter((r) => r.kind === "results.full");
    check(fullBatches.length === 2, "two full-results batches: on their own, then chosen");
    const early = await as.alex.call("POST", `/api/seasons/${sid}/changes/${quickBatch.batch}/undo${q}`);
    check(early.status === 409, "undoing who went home under later full results: the later change first", JSON.stringify(early.body));
    const rileyUndo = await as.riley.call("POST", `/api/seasons/${sid}/changes/${fullBatches[1].batch}/undo${q}`);
    check(rileyUndo.status === 403, "riley can't undo a change to games she doesn't run");
    for (const fb of [...fullBatches].reverse()) {
      const r = await as.alex.call("POST", `/api/seasons/${sid}/changes/${fb.batch}/undo${q}`);
      check(r.status === 200 && r.body.undone === 3, `undo ${fb.text}`, JSON.stringify(r.body));
    }
    const e5 = await allEp6();
    check(e5.every((e) => e.outs === 1 && e.events === 0 && e.stage === "early"), "back to early: who went home stays, the scoring's gone", JSON.stringify(e5));

    // ---- 3. classic's writes ----
    const { rows: [lineupRow] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L.lineup]);
    const pointsBefore = lineupRow.state.settings.defaultBetPoints;
    await as.alex.call("PATCH", `/api/leagues/${L.lineup}/settings`, { field: "defaultBetPoints", value: (pointsBefore || 1) + 2 });
    await as.alex.call("PUT", `/api/leagues/${L.outlast}/members/${fx.users.riley}/role`, { role: "admin" });
    const ep7 = lineupRow.state.episodes.find((e) => e.number === 7);
    const samSeat = lineupRow.state.players.find((p) => p.name === "sam").id;
    const alexSeat = lineupRow.state.players.find((p) => p.name === "alex").id;
    const samRows = (await pool.query("SELECT count(*)::int AS n FROM league_changes WHERE kind = 'lineup'")).rows[0].n;
    await as.sam.call("PUT", `/api/leagues/${L.lineup}/episodes/${ep7?.id}/lineups/${samSeat}?quiet`, { castawayIds: [] });
    check((await pool.query("SELECT count(*)::int AS n FROM league_changes WHERE kind = 'lineup'")).rows[0].n === samRows, "a player's own lineup isn't a change");
    await as.alex.call("PUT", `/api/leagues/${L.lineup}/episodes/${ep7?.id}/lineups/${alexSeat}?quiet`, { castawayIds: [] });
    const samView = await as.sam.call("GET", `/api/seasons/${sid}/changes${q}`);
    const settingsLine = samView.body.lines.find((l) => l.kind === "settings");
    const roleLine = samView.body.lines.find((l) => l.kind === "role");
    check(settingsLine && /settings/.test(settingsLine.text) && !settingsLine.undoable, "sam reads the settings change, with nothing to undo");
    check(roleLine && roleLine.text === "Made zt_nd_riley a Game admin", "a role change reads as one", roleLine?.text);
    check(samView.body.lines.every((l) => !l.undoable), "a player can undo nothing");
    const alexView = await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`);
    for (const kind of ["settings", "role"]) {
      const l = alexView.body.lines.find((x) => x.kind === kind);
      const r = await as.alex.call("POST", `/api/seasons/${sid}/changes/${l.batch}/undo${q}`);
      check(r.status === 200, `undo the ${kind} change (tier 1)`, JSON.stringify(r.body));
    }
    const { rows: [after] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L.lineup]);
    check(after.state.settings.defaultBetPoints === pointsBefore, "the setting is back");
    const { rows: [role] } = await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [L.outlast, fx.users.riley]);
    check(role.role === "member", "riley's role is back");
    // Who went home entered in classic: logged, and undoable like any results change.
    const { rows: [poolRow] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L.pool]);
    const next = poolRow.state.castaways.find((c) => c.status !== "eliminated");
    const ep7pool = poolRow.state.episodes.find((e) => e.number === 7);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]); // Episode 7 has aired too
    await as.alex.call("POST", `/api/leagues/${L.pool}/episodes/${ep7pool.id}/eliminations`, { castawayId: next.id, method: "Voted Out" });
    const classic = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    check(classic.text === "Entered who went home in Episode 7" && classic.undoable && classic.games.join() === "Pool Party", "classic's elimination is logged with its undo", JSON.stringify(classic));
    const undoClassic = await as.alex.call("POST", `/api/seasons/${sid}/changes/${classic.batch}/undo${q}`);
    const { rows: [poolAfter] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L.pool]);
    check(undoClassic.status === 200 && poolAfter.state.castaways.find((c) => c.id === next.id).status !== "eliminated", "and undone");
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date + 7 WHERE id = $1", [sid]);
    const allLines = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines;
    check(allLines.every((l) => !/Cristian|Devin|Danny|Eric/.test(l.text)), "no line names a castaway");

    // ---- 4. players ----
    const s = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(s.close);
    await s.page.goto(`${BASE}/show/${sid}/backstage`);
    await s.page.getByText("Backstage is for whoever runs a game").waitFor();
    check(true, "sam's Backstage: it's for whoever runs a game");
    await s.page.goto(`${BASE}/show/${sid}/backstage/history`);
    await s.page.locator("[data-change]").first().waitFor();
    check((await s.page.locator("[data-undo]").count()) === 0, "sam's Recent changes: no Undo");
    check(!(await s.page.evaluate(() => document.body.innerText)).includes(OUT6), "sam's Recent changes names nobody");
    await s.page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-sam-changes-${width}.png`) });
    const r = await open({ user: fixture.username("riley"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(r.close);
    await r.page.goto(`${BASE}/show/${sid}/tonight`);
    await r.page.getByRole("button", { name: /Show menu/ }).click();
    await r.page.locator("[role=dialog]").getByText("Recent changes").waitFor();
    check(true, "riley's ⋯ menu has Recent changes");
    const alexErrors = errors.filter((e) => !/Failed to load resource/.test(e)).concat(errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
    for (const [who, list] of [["alex", alexErrors], ["sam", s.errors], ["riley", r.errors]]) check(!list.length, `no page errors (${who})`, [...list, ...(who === "alex" ? failed : [])].join(" | "));
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
