// Dev-only check for Backstage II (docs/PLAN-new-design.md step 6a), against the dev server, on new-fixture.js (three
// linked leagues on a zt Survivor 51, results through Episode 5: alex owes a replacement for Carter in Outlast, an
// exclusive game; Weekly Lineup is shared and has a quiet week):
//   1. The API: your waiver week per game (who to replace, your team, who's free, picking order), nobody else's picks,
//      sam (on Episode 3) told to reveal first, someone off the couch 404.
//   2. As alex in a browser at --width: Episodes' waiver row, the Waivers page (Replace Carter, yellow Swap, the
//      fallback line, picking order, the bottom bar), the picker with the Cast tab's controls (a pick, backups, Change,
//      Clear), the claim in waiver_claims and never in what anyone else reads; How waivers work here.
//   3. Backstage › Waivers: who's picked with no contents, Open a waiver window's presets, the feel on tap with the
//      toast's Undo, Fine-tune, Run now's tier-2 preview (nothing private in it), the last run with Undo.
//   4. The run plays like an episode: Tonight's "Waivers ran" plate and its reveal, Episodes' row into its page, the
//      Waivers page after the run, a shared game's swap through the picker, free agency.
//   5. Game settings (starters with the bench following after the draft, Reset to recommended, who can join with Undo,
//      the end-a-game Preview, a Game admin refused), Lock it down (step 15 part 4: competitive mode for all three games in
//      one batch with Undo, nobody new, the settings and the rules frozen and refused while it's on, Recent changes' Undo of a
//      settings or points line from before refused too and said in the quiet toast, a Game admin refused),
//      Scoring rules' read side (the rulebook, How it works, the points, Make it ours opens its sheet: check-new-ours.js
//      covers it, since step 6b part 3). Games as data (docs/PLAN-start-a-game-gpt.md step A2): the starters stop at the
//      team once it's drafted, and a change past the one set of limits is refused here and through classic's settings
//      route, by the game spec's validator. With the game-specs flag on (scripts/game-specs-flag.js), the fixture's games
//      carry their spec, and after every write the check makes, none has drifted from what its fields play.
//   6. Members & roles: named as the games name them, a game's sheet (share it), a role for all three games with Undo,
//      the last Commissioner refused (stepping down, leaving here and in classic), tier 3's hold (a tap does nothing, a
//      hold removes, Recent changes restores for 30 days), and leaving from the show's ⋯ menu.
// Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-backstage-ii.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-backstage-ii runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-backstage-ii.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const first = (name) => name.split(" ")[0];

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
      [fx.users.alex, fx.users.riley, fx.users.jordan, fx.users.sam],
    ]);
    const state = async (key) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]])).rows[0].state;
    const claimRow = async (key, playerId) =>
      (await pool.query("SELECT pairs FROM waiver_claims WHERE league_id = $1 AND player_id = $2", [L[key], playerId])).rows[0]?.pairs ?? null;
    const memberships = async (who) => (await pool.query("SELECT league_id, role, results_seen_through FROM league_memberships WHERE user_id = $1 AND league_id = ANY($2::uuid[])", [fx.users[who], [L.outlast, L.lineup, L.pool]])).rows;

    // The game-specs flag on: the fixture's games carry their spec, as every league does then (db/game-specs.js).
    const carrying = await GameSpecs.gameSpecsOn(pool);
    if (carrying) for (const id of Object.values(L)) await GameSpecs.syncLeagueRow(pool, id, true);

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const bs = (who, page, method = "GET", body) => as[who].call(method, `/api/seasons/${sid}/backstage/${page}${q}`, body);

    // ---- 1. the API: your waiver week ----
    const wv = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/waivers${q}`)).body.games ?? [];
    const alexWeeks = await wv("alex");
    const cup = alexWeeks.find((w) => w.leagueId === L.outlast);
    const lineupWeek = alexWeeks.find((w) => w.leagueId === L.lineup);
    const carter = cup?.team.find((f) => f.name === "Carter Krull");
    check(alexWeeks.length === 2 && !alexWeeks.some((w) => w.leagueId === L.pool), "alex's waivers: Outlast and Weekly Lineup (Survival Pool has none)", alexWeeks.map((w) => w.gameName).join());
    check(cup?.stage === "open" && carter && cup.replace.join() === carter.id && carter.out === 5, "Outlast: replace Carter, out in Episode 5", JSON.stringify(cup?.replace));
    check(cup?.team.length === 3 && cup.free.length >= 3 && !cup.shared && cup.order.length === 4 && cup.order.some((o) => o.you), "your team, who's free and the picking order (exclusive)");
    check(cup?.free.some((f) => f.points > 0 && f.tag), "who's free carries the Cast tab's points and a positive tag", JSON.stringify(cup?.free.slice(0, 2)));
    check(lineupWeek?.shared && lineupWeek.replace.length === 0 && lineupWeek.swapsAllowed === 0, "Weekly Lineup (shared): nothing to do this week");
    const samCup = (await wv("sam")).find((w) => w.leagueId === L.outlast);
    check(samCup?.revealFirst === 5 && samCup.replace.length === 0 && samCup.spots.length === 0, "sam (on Episode 3): reveal Episode 5 first, nothing that says who left", JSON.stringify(samCup && { r: samCup.revealFirst, rep: samCup.replace }));
    check((await as.casey.call("GET", `/api/seasons/${sid}/waivers${q}`)).status === 404, "someone off the couch: 404");

    // ---- 2. the browser, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    const failed = [];
    let favicon = 0;
    page.on("response", (res) => res.status() >= 400 && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    page.on("console", (m) => {
      if (m.type() !== "error" || !m.location()?.url) return;
      if (m.location().url.endsWith("/favicon.ico")) favicon++;
    });
    await page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const fits = async (where, p = page) => {
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    let n = 0;
    const shot = async (name, p = page) => {
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const toasted = async (re, p = page) => {
      try {
        await p.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
      } catch {
        /* the text says what came instead */
      }
      return ((await p.locator("[role=status]").textContent().catch(() => "")) || "").trim();
    };
    const toastUndo = (p = page) => p.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
    const text = (p = page) => p.evaluate(() => document.body.innerText);
    const sheetGone = async (p = page) => p.locator("[role=dialog] [data-sheet-handle]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});

    await page.goto(`${BASE}/show/${sid}/episodes`);
    const row = page.locator("[data-wv-ep=open]");
    await row.waitFor({ timeout: 20000 });
    const rowText = await row.innerText();
    check(/Outlast waivers · after Episode 5/.test(rowText) && /replace Carter/.test(rowText), "Episodes: the waiver row sits after Episode 5", rowText.replace(/\n/g, " "));
    const dock = (await page.locator(".nd-dock").innerText().catch(() => "")).replace(/\n/g, " ");
    check(/Due .* · in \d+ days/.test(dock), "the dock says the waiver pick's deadline (Due), not airtime", dock);
    await fits("Episodes");
    await shot("episodes");
    // The dock's Set goes where Tonight's card does: the waiver pick is due first, so Waivers at Outlast (before the
    // 2026-10-26 critique it opened Your moves on the Weekly Lineup tab).
    await page.locator(".nd-dock").click();
    await page.waitForURL((u) => u.pathname.endsWith("/waivers"), { timeout: 15000 }).catch(() => {});
    check(page.url().includes(`/waivers?game=${L.outlast}`), "the dock's Set opens Waivers at Outlast, as Tonight's card does", page.url());
    await page.goBack();
    await row.waitFor({ timeout: 20000 });
    await row.click();
    await page.locator("[data-wv-week=open]").waitFor({ timeout: 20000 });
    check(page.url().includes(`/waivers?game=${L.outlast}`), "the row opens Waivers at Outlast");
    check((await page.locator("[data-wv-head]").innerText()).toLowerCase() === "replace carter", "the heading: Replace Carter");
    check((await page.locator('[data-chip=replace]').innerText()).includes("Replace Carter"), "the chip: Replace Carter (yellow: needed)");
    check((await page.locator('[data-swap="Carter Krull"]').count()) === 1 && (await page.locator('[data-swap="Eric Macksoud"]').count()) === 0, "Swap on Carter; nothing optional this week (no swaps)");
    check(/Forget, and Carter's spot gets whoever's free with the most points/.test(await page.locator("[data-wv-fallback]").innerText()), "the fallback line: forget, and the most points left comes in");
    check((await page.locator("[data-wv-order] li").count()) === 4 && (await page.locator("[data-wv-order] li[data-you]").innerText()).includes("You"), "picking order as four faces, you among them");
    check(/Carter's spot is open/.test(await page.locator("[data-wv-bar]").innerText()), "the bottom bar: Carter's spot is open");
    check(!(await text()).match(/\bpts lost\b|points go|keeps \d+ pts/), "no points copy");
    await fits("Waivers");
    await shot("waivers-open");

    // The picker: the Cast tab's controls, a pick and a backup.
    await page.locator('[data-swap="Carter Krull"]').click();
    await page.locator("[data-wv-picker]").waitFor();
    await page.locator("[data-wv-picker] [data-slider]").waitFor({ timeout: 10000 }).catch(() => {});
    check((await page.locator("[data-wv-picker] [data-slider]").count()) === 1 && (await page.locator("[data-wv-picker] select").count()) === 2, "the picker: the episode slider, Ranked by and Show");
    const tiles = page.locator("[data-wv-picker] [data-fa]");
    const firstName = await tiles.first().getAttribute("data-fa");
    const secondName = await tiles.nth(1).getAttribute("data-fa");
    check(firstName === [...cup.free].sort((a, b) => b.points - a.points)[0].name, "ranked by points, most first", firstName);
    await page.locator("[data-wv-picker] select").first().selectOption({ index: 2 }).catch(() => {});
    await page.locator("[data-wv-picker] select").first().selectOption("points");
    await page.locator("[data-wv-own]").click();
    await tiles.filter({ hasText: firstName }).first().click();
    await page.locator(`[data-wv-picker] [data-fa="${secondName}"]`).click();
    check((await page.locator("[data-wv-save]").innerText()).includes(`Save ${first(firstName)} + 1 backup`), "your pick, then a backup in order");
    await fits("the picker");
    await shot("picker");
    await page.locator("[data-wv-save]").click();
    const saved = await toasted(/comes in for Carter/);
    check(saved.includes(`${first(firstName)} comes in for Carter, unless someone ahead of you takes ${first(firstName)} first`), "saved: the toast says the order can take them", saved);
    await sheetGone();
    const alexOut = (await state("outlast")).players.find((p) => p.name === "alex").id;
    const pairs = await claimRow("outlast", alexOut);
    const nameOf = async (key, id) => (await state(key)).castaways.find((c) => c.id === id)?.name;
    check(pairs?.length === 2 && pairs.every((p) => p.dropId === carter.id) && (await nameOf("outlast", pairs[0].addId)) === firstName, "the claim is in waiver_claims: first choice, then the backup", JSON.stringify(pairs));
    await page.locator("[data-wv-in]").waitFor();
    check(/Your swaps are in/i.test(await page.locator("[data-wv-head]").innerText()) && (await page.locator("[data-wv-in]").innerText()).includes(`Backup: ${first(secondName)}`), "the page: your swaps are in, the backup named");
    await page.waitForFunction(() => /1 swap in/i.test(document.querySelector("[data-wv-bar]")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    check(/1 swap in/i.test(await page.locator("[data-wv-bar]").innerText()), "the bottom bar keeps score: 1 swap in");
    await shot("waivers-set");
    // Change: clear it, then just the first choice.
    await page.locator("[data-wv-in]").click();
    await page.locator("[data-wv-clear]").click();
    check(/Cleared/.test(await toasted(/Cleared/)), "Clear my pick");
    await sheetGone();
    check((await claimRow("outlast", alexOut)) === null, "cleared: no claim row");
    await page.locator('[data-swap="Carter Krull"]').click();
    await page.locator(`[data-wv-picker] [data-fa="${firstName}"]`).click();
    await page.locator("[data-wv-save]").click();
    await toasted(/comes in for Carter/);
    await sheetGone();
    check((await claimRow("outlast", alexOut))?.length === 1, "picked again: one choice");
    const pickId = (await claimRow("outlast", alexOut))[0].addId;
    const jordanCup = (await wv("jordan")).find((w) => w.leagueId === L.outlast);
    check(jordanCup.spots.length === 0 && !JSON.stringify((await bs("alex", "waivers")).body).includes(pickId), "nobody else's read has alex's pick in it, Backstage's included");
    await page.locator("[data-wv-how]").click();
    await page.locator("[data-wv-how-sheet]").waitFor();
    check((await page.locator("[data-wv-how-sheet] [data-wv-lanes] i").count()) >= 10 && /Two of you want the same person/.test(await text()), "How waivers work here: three answers, then When moves happen");
    await shot("how");
    await page.keyboard.press("Escape");
    await sheetGone();
    await page.locator('[data-wv-game="Weekly Lineup"]').click();
    await page.locator("[data-wv-week=quiet]").waitFor();
    check(true, "Weekly Lineup: nothing to do this week");

    // ---- 3. Backstage › Waivers ----
    await page.goto(`${BASE}/show/${sid}/backstage`);
    await page.locator("text=Members & roles").first().waitFor({ timeout: 20000 });
    check((await page.locator("[data-preview^=backstage]").count()) === 0, "Backstage's index: nothing Preview any more");
    await page.goto(`${BASE}/show/${sid}/backstage/waivers`);
    await page.locator("[data-bs-plate]").waitFor({ timeout: 20000 });
    check((await page.locator("[data-bs-plate]").getAttribute("data-bs-plate")) === "open" && (await page.locator("[data-claim]").count()) === 4, "Waivers: the week, and who's picked");
    check(/Picks in/.test(await page.locator('[data-claim="alex"]').innerText()) && /No picks yet/.test(await page.locator('[data-claim="jordan"]').innerText()), "who has picks in, and who hasn't");
    check(!(await text()).includes(firstName), "never what they picked");
    await fits("Backstage › Waivers");
    await shot("bs-waivers");
    await page.locator('[data-bs-game="Weekly Lineup"]').click();
    await page.locator("[data-bs-change]").click();
    await page.locator("[data-bs-window]").waitFor();
    check((await page.locator("[data-preset]").count()) === 3, "Open a waiver window: three presets");
    await page.locator("[data-preset=one]").click();
    await shot("bs-window");
    await page.locator("[data-bs-open-go]").click();
    const opened = await toasted(/Window open/);
    check(/Replace who's out · 1 optional swap each/.test(opened), "the couch is told what the window allows", opened);
    await sheetGone();
    const lineupAdmin = async () => (await bs("alex", "waivers")).body.games.find((g) => g.leagueId === L.lineup);
    check((await lineupAdmin()).period?.window && (await lineupAdmin()).period.swaps === 1, "the window is open: 1 swap each");
    // The feel, on tap, with the toast's Undo.
    await page.locator("[data-bs-settings]").click();
    await page.locator("[data-bs-feel-sheet]").waitFor();
    await page.locator("[data-feel=casual]").click();
    check(/Waivers on Casual/.test(await toasted(/Waivers on Casual/)), "a feel applies on tap");
    let s = await state("lineup");
    check(s.settings.waiverFeel === "casual" && s.settings.replenishOrderBy === "leastPoints" && s.settings.autoFill === true, "Casual: lowest score first, the fallback on", JSON.stringify({ f: s.settings.waiverFeel, o: s.settings.replenishOrderBy }));
    await shot("bs-feel");
    await toastUndo();
    await page.waitForTimeout(1500);
    s = await state("lineup");
    check(s.settings.waiverFeel === "balanced" && s.settings.replaceRule === "whenShort" && (s.settings.replenishOrderBy ?? "rolling") === "rolling", "the toast's Undo puts the settings back", JSON.stringify({ f: s.settings.waiverFeel, r: s.settings.replaceRule }));
    await page.locator("[data-fine]").click();
    await page.locator("[data-fine-body]").waitFor();
    await page.locator("[data-fine-body]").getByRole("button", { name: /Fallback pick/ }).click();
    await toasted(/Saved/);
    check((await state("lineup")).settings.autoFill === false, "Fine-tune: the fallback pick off");
    const fineLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    check(fineLine.text === "Changed how waivers work" && fineLine.undoable, "it's in Recent changes with Undo", JSON.stringify(fineLine));
    await as.alex.call("POST", `/api/seasons/${sid}/changes/${fineLine.batch}/undo${q}`);
    check((await state("lineup")).settings.autoFill === true, "and undone from there");
    await page.keyboard.press("Escape");
    await sheetGone();
    check((await bs("riley", "waivers", "POST", { leagueId: L.lineup, action: "feel", feel: "casual" })).status === 403, "a Game admin can't change how waivers work");
    check((await bs("riley", "waivers")).body.games?.map((g) => g.leagueId).join() === L.lineup, "riley (Game admin of Weekly Lineup) runs only its waivers");
    // Run now: tier 2, with nothing private in it.
    await page.reload();
    await page.locator('[data-bs-game="Outlast"]').click();
    await page.locator("[data-bs-run]").click();
    await page.locator("[data-run-preview]").waitFor();
    const preview = await page.locator("[data-guard='2']").innerText();
    check(/1 of 4 have picks in/.test(preview) && /most points/.test(preview) && /free agency until/i.test(preview), "Run now previews: picks in, the fallback, free agency", preview.replace(/\n/g, " | "));
    check(!preview.includes(firstName) && !preview.includes("Carter"), "the preview names nobody's pick");
    await shot("bs-run-preview");
    await page.locator("[data-guard-confirm]").click();
    check(/Waivers ran/.test(await toasted(/Waivers ran/)), "Run now: waivers ran");
    s = await state("outlast");
    const ori = s.castaways.find((c) => c.name === firstName);
    check(ori.ownerIds.includes(alexOut) && !s.castaways.find((c) => c.id === carter.id).ownerIds.includes(alexOut), `alex got ${firstName} for Carter`);
    const runLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    check(/^Ran waivers: \d+ moves?$/.test(runLine.text) && runLine.tier === 2 && runLine.undoable, "Recent changes: the run, tier 2, with Undo", runLine.text);
    await page.locator("[data-bs-undo-run]").waitFor();
    check((await page.locator("section", { hasText: "Last run" }).innerText()).includes(`alex got ${firstName}`), "Last run: who got whom");
    await shot("bs-ran");

    // ---- 4. the run plays like an episode ----
    await page.goto(`${BASE}/show/${sid}/tonight`);
    await page.locator("[data-wv-plate]").waitFor({ timeout: 20000 });
    check(true, "Tonight: the Waivers ran plate");
    await shot("tonight-plate");
    await page.locator("[data-wv-plate]").click();
    await page.locator("[data-beat=open]").waitFor();
    await shot("run-open");
    await page.locator("[data-stage]").click();
    await page.locator("[data-beat=yours]").waitFor();
    check((await page.locator("[data-beat=yours]").innerText()).toLowerCase().includes(firstName.toLowerCase()), "the reveal: you got them");
    await shot("run-yours");
    for (let i = 0; i < 4 && !(await page.locator("[data-wv-done]").isVisible()); i++) await page.locator("[data-stage]").click();
    await page.locator("[data-wv-done]").click();
    await page.locator("[data-wv-plate]").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    check((await page.locator("[data-wv-plate]").count()) === 0, "watched: the plate goes");
    await page.goto(`${BASE}/show/${sid}/episodes`);
    await page.locator("[data-wv-ep=ran]").waitFor({ timeout: 20000 });
    check(new RegExp(`You got ${first(firstName)} for Carter`).test(await page.locator("[data-wv-ep=ran]").innerText()), "Episodes: the run's row says what you got");
    await page.locator("[data-wv-ep=ran]").click();
    await page.locator("[data-wv-run-page]").waitFor();
    check((await page.locator("[data-wv-run-page] [data-wv-move]").count()) >= 1, "its page: the moves in picking order");
    await fits("the run's page");
    await shot("run-page");
    await page.goto(`${BASE}/show/${sid}/waivers?game=${L.outlast}`);
    await page.locator("[data-wv-week=ran]").waitFor({ timeout: 20000 });
    check((await text()).includes(`${first(firstName)}'s on your team`.toUpperCase()) || (await page.locator("[data-wv-week=ran]").innerText()).toLowerCase().includes(`${first(firstName)}'s on your team`.toLowerCase()), "Waivers after the run: they're on your team");
    await shot("waivers-ran");
    // A shared game's swap through the picker (no order, no backups), then its run.
    await page.goto(`${BASE}/show/${sid}/waivers?game=${L.lineup}`);
    await page.locator("[data-wv-week=open]").waitFor({ timeout: 20000 });
    check(/Optional · 1 free swap/.test(await page.locator("[data-chip=swap]").innerText()) && (await page.locator("[data-wv-order]").count()) === 0, "Weekly Lineup's window: one optional swap, no picking order (shared)");
    const keep_ = await page.locator("[data-swap]").first().getAttribute("data-swap");
    await page.locator("[data-swap]").first().click();
    await page.locator("[data-wv-picker]").waitFor();
    check((await page.locator("[data-wv-own]").count()) === 0, "shared: no backups to choose");
    const swapIn = await page.locator("[data-wv-picker] [data-fa]").first().getAttribute("data-fa");
    await page.locator("[data-wv-picker] [data-fa]").first().click();
    await page.locator("[data-wv-save]").click();
    check(new RegExp(`${first(swapIn)} comes in for ${first(keep_)}$`).test(await toasted(/comes in for/)), "the swap is saved");
    await sheetGone();
    check(/Optional swap used/.test(await page.locator("[data-chip=swap]").innerText()), "the chip: optional swap used");
    await shot("lineup-swap");
    await bs("alex", "waivers", "POST", { leagueId: L.lineup, action: "run" });
    const lineupNow = await state("lineup");
    const alexLine = lineupNow.players.find((p) => p.name === "alex").id;
    check(lineupNow.castaways.find((c) => c.name === swapIn).ownerIds.includes(alexLine), "the shared game's run: the swap went through");
    const jordanWeek = (await wv("jordan")).find((w) => w.leagueId === L.lineup);
    const fa = await as.jordan.call("POST", `/api/leagues/${L.lineup}/waivers/free-agency?quiet`, { addId: jordanWeek.free[0].id, dropId: jordanWeek.team.find((f) => f.out == null).id });
    check(fa.status === 200 && fa.body.ok === true, "free agency: jordan's move goes through (?quiet answers { ok })", JSON.stringify(fa.body));
    const faWeek = (await wv("alex")).find((w) => w.leagueId === L.lineup);
    check(faWeek.run?.freeAgency.some((m) => m.name === "jordan"), "the week's page lists free agency's move");

    // ---- 5. Game settings and Scoring rules ----
    await page.goto(`${BASE}/show/${sid}/backstage/settings`);
    await page.locator("[data-settings=lineup]").waitFor({ timeout: 20000 });
    await page.locator("[data-settings=lineup]").getByRole("button", { name: "More" }).first().click();
    check(/4 score each week from Episode 6/.test(await toasted(/score each week/)), "Who scores each week: more starters, from the next episode");
    s = await state("lineup");
    check(s.settings.activeSlots === 4 && s.settings.benchSlots === 1, "after the draft the bench gives one up (the team stays 5)", `${s.settings.activeSlots}/${s.settings.benchSlots}`);
    // Games as data (A2): the most is the drafted team, and the spec's validator holds the one set of limits everywhere.
    const lineupMax = (await bs("alex", "settings")).body.games.find((g) => g.leagueId === L.lineup)?.lineup?.max;
    check(lineupMax?.starters === 5 && lineupMax?.bench === 1, "drafted, the starters go up to the team (5)", JSON.stringify(lineupMax));
    check((await bs("alex", "settings", "PATCH", { leagueId: L.lineup, set: { activeSlots: 6 } })).status === 400, "more starters than the team: refused (400)");
    const classic = (key, field, value) => as.alex.call("PATCH", `/api/leagues/${L[key]}/settings`, { field, value });
    const tooBig = await classic("outlast", "teamSize", 11);
    check(tooBig.status === 400 && /1 to 10/.test(tooBig.body.error), "classic's settings route: an Outlast team past 10 is refused, with why", `${tooBig.status} ${JSON.stringify(tooBig.body)}`);
    check((await classic("lineup", "activeSlots", 9)).status === 400, "and a lineup past 8 starters");
    check((await state("outlast")).settings.teamSize !== 11 && (await state("lineup")).settings.activeSlots === 4, "nothing written");
    const more = page.locator("[data-settings=lineup]").getByRole("button", { name: "More" }).first();
    await more.click();
    await toasted(/5 score each week/);
    await page.waitForFunction(() => document.querySelector("[data-settings=lineup] button[aria-label=More]")?.disabled === true, null, { timeout: 15000 }).catch(() => {});
    check((await state("lineup")).settings.activeSlots === 5 && (await more.isDisabled()), "all five start: More stops at the team");
    await shot("settings-most");
    await page.locator("[data-reset=lineup]").waitFor();
    check((await page.locator("[data-settings=lineup] [data-changed]").count()) >= 1, "changed from recommended: a dot, and Reset to recommended");
    await shot("settings-changed");
    await page.locator("[data-reset=lineup]").click();
    await toasted(/Back to recommended/);
    s = await state("lineup");
    check(s.settings.activeSlots === 3 && s.settings.benchSlots === 2, "Reset to recommended: 3 score, 2 on the bench");
    check(/Set at the draft/.test(await page.locator("[data-settings=lineup]").innerText()), "the bench is set at the draft");
    await page.locator('[data-settings-game="Outlast"] [data-join=locked]').click();
    check(/Nobody new/.test(await toasted(/Nobody new/)), "who can join: nobody new");
    check((await state("outlast")).settings.allowLateJoiners === false, "saved at once");
    await toastUndo();
    await page.waitForTimeout(1500);
    check((await state("outlast")).settings.allowLateJoiners !== false, "and the toast's Undo opens it again");
    check((await page.locator("[data-end-games]").count()) === 1, "archive or delete a game, folded at the end (step 10 part 2b)");
    check((await bs("alex", "settings", "PATCH", { leagueId: L.lineup, set: { benchSlots: 3 } })).status === 409, "the bench can't change after the draft (409)");
    check((await bs("riley", "settings", "PATCH", { leagueId: L.lineup, set: { activeSlots: 4 } })).status === 403, "a Game admin can't change settings");
    await fits("Game settings");
    await shot("settings");

    // Lock it down (step 15 part 4): competitive mode, every game alex runs here at once.
    check((await bs("riley", "settings", "PATCH", { lockDown: true })).status === 403, "Lock it down: a Game admin can't");
    check((await bs("alex", "settings", "PATCH", { lockDown: "yes" })).status === 400, "lockDown must be true or false");
    const lockRow = page.locator("[data-lock-down]");
    await lockRow.scrollIntoViewIfNeeded();
    check((await lockRow.getAttribute("data-lock-down")) === "off" && /No late joins, no catch-up, rules frozen for the season/.test(await lockRow.innerText()), "Competitive mode: Lock it down, off, saying what it does");
    // A points change just before it (Reset to recommended above is the settings one), for Recent changes' Undo below.
    const pointsOf = async () => (await bs("alex", "rules")).body.games.find((g) => g.leagueId === L.lineup).points.flatMap((g) => g.items).filter((i) => typeof i.points === "number");
    const { id: moment, points: pts0 } = (await pointsOf())[0];
    const pointsNow = async () => (await pointsOf()).find((i) => i.id === moment)?.points;
    const ptsBatch = (await bs("alex", "rules", "POST", { action: "points", leagueId: L.lineup, points: { [moment]: pts0 + 1 } })).body?.batch;
    check(!!moment && !!ptsBatch, "a points change before the lock, with Undo", `${moment}: ${pts0} → ${pts0 + 1}`);
    await lockRow.locator("[data-setting=lock-down]").click();
    check(/Competitive mode on/.test(await toasted(/Competitive mode on/)), "on: Competitive mode on, with Undo");
    const locked = await Promise.all(["outlast", "lineup", "pool"].map(state));
    check(locked.every((x) => x.settings.lockedDown === true), "all three games locked down", locked.map((x) => x.settings.lockedDown).join());
    const { rows: lockLines } = await pool.query("SELECT DISTINCT batch, text FROM league_changes WHERE league_id = ANY($1::uuid[]) AND text LIKE 'Locked the game down%'", [[L.outlast, L.lineup, L.pool]]);
    check(lockLines.length === 1, "one batch, a line in Recent changes for the couch to see", JSON.stringify(lockLines));
    const joinable = (await as.riley.call("GET", `/api/couches/${fx.couchId}/games`)).body.games;
    check(joinable.filter((g) => [L.outlast, L.lineup, L.pool].includes(g.leagueId)).every((g) => g.mode === "locked" && g.lockedDown), "nobody new: every game says locked, locked down");
    check(/Locked down for the season/.test(await page.locator('[data-settings-game="Outlast"] [data-settings=joining]').innerText()) && (await page.locator('[data-settings-game="Outlast"] [data-join=ask]').isDisabled()), "Who can join says so, and can't be changed");
    check(await page.locator("[data-settings=lineup]").getByRole("button", { name: "More" }).first().isDisabled(), "the lineup's size is frozen");
    check((await bs("alex", "settings", "PATCH", { leagueId: L.lineup, set: { activeSlots: 4 } })).status === 409, "a settings change is refused (409)");
    check((await bs("alex", "rules", "POST", { action: "ours" })).status === 409, "and Make it ours (409)");
    check((await bs("alex", "rules", "POST", { action: "points", leagueId: L.lineup, points: { immunity: 3 } })).status === 409, "and the points (409)");
    await shot("settings-locked");
    await page.goto(`${BASE}/show/${sid}/backstage/rules`);
    await page.locator("[data-rules-frozen]").waitFor({ timeout: 20000 });
    check(/Frozen for the season/i.test(await page.locator("[data-rules-frozen]").innerText()), "Scoring rules: frozen for the season");
    await page.locator("[data-make-ours]").click();
    check(/Locked down for the season/.test(await toasted(/Locked down/)), "Make it ours says why it can't");
    check((await page.locator("[role=status] [data-toast]").getAttribute("data-toast")) === "quiet", "in the quiet toast (no tick: it isn't done)");
    await shot("rules-frozen");
    // Recent changes' Undo is a change too: a settings or points line from before the lock is refused while it's on (Lock it down's own
    // line isn't: the toast's Undo below takes it off).
    const undoLine = (batch) => as.alex.call("POST", `/api/seasons/${sid}/changes/${batch}/undo${q}`);
    const resetBatch = (await pool.query("SELECT batch FROM league_changes WHERE league_id = $1 AND text = 'Set the game back to recommended' AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1", [L.lineup])).rows[0]?.batch;
    const refusedReset = await undoLine(resetBatch);
    check(refusedReset.status === 409 && /Locked down for the season/.test(refusedReset.body?.error ?? ""), "Undo of Reset to recommended is refused while locked down (409)", `${refusedReset.status} ${refusedReset.body?.error}`);
    check((await state("lineup")).settings.activeSlots === 3, "and 3 still score each week");
    const refusedPts = await undoLine(ptsBatch);
    check(refusedPts.status === 409 && (await pointsNow()) === pts0 + 1, "so is Undo of the points change, and the points stay", `${refusedPts.status}`);
    await page.goto(`${BASE}/show/${sid}/backstage/history`);
    await page.locator(`[data-undo="${ptsBatch}"]`).click();
    check(/Locked down for the season/.test(await toasted(/Locked down/)) && (await page.locator("[role=status] [data-toast]").getAttribute("data-toast")) === "quiet", "on the page: its Undo says why, in the quiet toast");
    await shot("history-locked-undo");
    await page.goto(`${BASE}/show/${sid}/backstage/settings`);
    await page.locator("[data-lock-down=on]").waitFor({ timeout: 20000 });
    await page.locator("[data-lock-down] [data-setting=lock-down]").click();
    check(/Back to casual/.test(await toasted(/Back to casual/)), "off again: Back to casual");
    check((await Promise.all(["outlast", "lineup", "pool"].map(state))).every((x) => !x.settings.lockedDown), "every game off lock down");
    await toastUndo();
    await page.waitForTimeout(1500);
    check((await Promise.all(["outlast", "lineup", "pool"].map(state))).every((x) => x.settings.lockedDown === true), "the toast's Undo locks them down again");
    check((await bs("alex", "settings", "PATCH", { lockDown: false })).status === 200 && (await Promise.all(["outlast", "lineup", "pool"].map(state))).every((x) => !x.settings.lockedDown), "and off once more (the rest of the check is casual)");
    check((await undoLine(ptsBatch)).status === 200 && (await pointsNow()) === pts0, "off: the points change undoes, as before the lock");

    await page.goto(`${BASE}/show/${sid}/backstage/rules`);
    await page.locator("[data-rulebook]").waitFor({ timeout: 20000 });
    check(/Following the Survivor rulebook/.test(await page.locator("[data-rulebook]").innerText()), "Scoring rules: the rulebook these games follow");
    const weeklyPoints = page.locator('[data-points="Weekly Lineup"]');
    check((await weeklyPoints.locator(".type-num").count()) >= 8 && (await page.locator('[data-points="Outlast"] li').count()) >= 3, "each game's points (Weekly Lineup by moment, Outlast in words)");
    await page.locator("[data-rules-how]").click();
    await page.locator("[data-how]").waitFor();
    check(true, "How it works opens over it");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.locator("[data-make-ours]").click();
    await page.locator("[data-ours-sheet]").waitFor();
    check(true, "Make it ours opens its sheet (check-new-ours.js makes it)");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await fits("Scoring rules");
    await shot("rules");

    // ---- 6. Members & roles ----
    await page.goto(`${BASE}/show/${sid}/backstage/members`);
    await page.locator("[data-member]").first().waitFor({ timeout: 20000 });
    const names = await page.locator("[data-member]").evaluateAll((els) => els.map((e) => e.getAttribute("data-member")));
    check(names.join() === "alex,riley,jordan,sam", "members named as the games name them, you first", names.join());
    check(/Commissioner · all 3 games/.test(await page.locator('[data-member="alex"]').innerText()), "alex: Commissioner · all 3 games");
    await fits("Members & roles");
    await shot("members");
    await page.locator('[data-runs="Outlast"]').click();
    await page.locator("[data-game-sheet]").waitFor();
    await page.locator('[data-game-sheet] [data-runner="riley"]').click();
    check(/riley runs Outlast too/.test(await toasted(/runs Outlast/)), "a game's sheet: share it with riley");
    check((await memberships("riley")).find((m) => m.league_id === L.outlast)?.role === "admin", "riley is a Game admin of Outlast");
    await toastUndo();
    await page.waitForTimeout(1500);
    check((await memberships("riley")).find((m) => m.league_id === L.outlast)?.role === "member", "and the toast's Undo takes it back");
    await page.keyboard.press("Escape");
    await sheetGone();
    await page.locator('[data-member-menu="jordan"]').click();
    await page.locator("[data-member-sheet]").waitFor();
    await page.locator("[data-member-sheet] [data-role=admin]").click();
    check(/jordan is now a Game admin/.test(await toasted(/Game admin/)), "jordan's sheet: a Game admin");
    check((await memberships("jordan")).every((m) => m.role === "admin"), "in all three games, one batch");
    const roleLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    check(roleLine.kind === "role" && roleLine.games.length === 3 && roleLine.undoable, "one line in Recent changes for the three games", JSON.stringify(roleLine));
    await as.alex.call("POST", `/api/seasons/${sid}/changes/${roleLine.batch}/undo${q}`);
    check((await memberships("jordan")).every((m) => m.role === "member"), "undone from Recent changes");
    await sheetGone();
    await page.reload();
    await page.locator('[data-member-menu="alex"]').click();
    await page.locator("[data-member-sheet]").waitFor();
    check(/Make someone else Commissioner first/.test(await page.locator("[data-member-sheet] [data-role=member]").innerText()), "your own sheet: the last Commissioner can't step down");
    // aria-disabled (it can't happen), but a tap still says why.
    await page.locator("[data-member-sheet] [data-role=member]").click({ force: true });
    check(/Every game needs a Commissioner/.test(await toasted(/Commissioner/)), "and tapping says so");
    await page.locator("[data-member-sheet] [data-out]").click();
    await page.locator("[data-guard-problem]").waitFor();
    check((await page.locator("[data-hold]").count()) === 0 && /Hand Couch Cup to someone first/.test(await page.locator("[data-guard-problem]").innerText()), "Leave these games: refused before any hold");
    await shot("leave-refused");
    await page.keyboard.press("Escape");
    await sheetGone();
    check((await as.alex.call("PUT", `/api/seasons/${sid}/backstage/members/${fx.users.alex}${q}`, { role: "member" })).status === 409, "the API refuses the last Commissioner stepping down (409)");
    check((await as.alex.call("POST", `/api/seasons/${sid}/leave${q}`, {})).status === 409, "and leaving (409)");
    check((await as.alex.call("POST", `/api/leagues/${L.outlast}/leave`, {})).status === 409, "and classic's leave (409)");
    // Tier 3: a tap does nothing; a hold removes; Recent changes restores.
    await page.reload();
    await page.locator('[data-member-menu="sam"]').click();
    await page.locator("[data-member-sheet] [data-out]").click();
    await page.locator("[data-hold]:not([disabled])").waitFor();
    const consequence = await page.locator("[data-guard='3']").innerText();
    check(/sam leaves Couch Cup, Lineup League, Pool Party/.test(consequence) && /Their team and points stay in the standings/.test(consequence) && /Restorable for 30 days/.test(consequence), "tier 3 says what happens, and that it's restorable", consequence.replace(/\n/g, " | "));
    await shot("hold");
    const hold = await page.locator("[data-hold]").boundingBox();
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(1800);
    check((await memberships("sam")).length === 3, "a tap does nothing");
    await page.mouse.down();
    await page.waitForTimeout(700);
    await shot("holding");
    await page.waitForTimeout(1100);
    await page.mouse.up();
    check(/sam is out · restorable for 30 days/.test(await toasted(/is out/)), "a hold takes sam out");
    check((await memberships("sam")).length === 0 && (await state("outlast")).players.find((p) => p.id === "demo_p_sam")?.disabled === true, "sam's memberships gone, the seat kept (disabled)");
    const outLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    const days = (Date.parse(outLine.undoUntil) - Date.now()) / 86400000;
    check(outLine.tier === 3 && outLine.undoable && days > 29 && days <= 30, "Recent changes: tier 3, restorable for 30 days", `${outLine.text} · ${days.toFixed(1)} days`);
    await sheetGone();
    await page.goto(`${BASE}/show/${sid}/backstage/history`);
    await page.locator(`[data-undo="${outLine.batch}"]`).click();
    await toasted(/Undone/);
    const back = await memberships("sam");
    check(back.length === 3 && back.every((m) => m.role === "member" && m.results_seen_through === 3) && (await state("outlast")).players.find((p) => p.id === "demo_p_sam")?.name === "sam", "restored from Recent changes: memberships, marks and the seat");
    await shot("restored");

    // Leaving from the show's ⋯ menu, as jordan.
    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    await j.page.goto(`${BASE}/show/${sid}/tonight`);
    await j.page.getByRole("button", { name: /Show menu/ }).click();
    await j.page.locator("[data-menu-main]").getByRole("button", { name: /^Everything else/ }).click();
    await j.page.locator("[data-menu-else]").getByText("Leave these games").click();
    await j.page.locator("[data-hold]:not([disabled])").waitFor({ timeout: 15000 });
    check(/You leave Couch Cup, Lineup League, Pool Party/.test(await j.page.locator("[data-guard='3']").innerText()), "the ⋯ menu: Leave these games, on a hold");
    await shot("jordan-leave", j.page);
    const jb = await j.page.locator("[data-hold]").boundingBox();
    await j.page.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2);
    await j.page.mouse.down();
    await j.page.waitForTimeout(1800);
    await j.page.mouse.up();
    await j.page.waitForURL(/\/home/, { timeout: 15000 }).catch(() => {});
    check((await memberships("jordan")).length === 0 && j.page.url().endsWith("/home"), "jordan left, and is home");
    const leftLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines[0];
    check(/left the games/.test(leftLine.text) && leftLine.undoable, "whoever runs the games can bring them back");
    await as.alex.call("POST", `/api/seasons/${sid}/changes/${leftLine.batch}/undo${q}`);
    check((await memberships("jordan")).length === 3, "jordan's back");

    const lines = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines;
    check(lines.every((l) => !/Carter/.test(l.text)), "no line names who went home");
    if (carrying) {
      // Every write above (waivers' feel and Undo, Fine-tune, Game settings, Reset, Lock it down and Recent changes' Undo,
      // the runs) kept each game's carried spec in step with its fields.
      const drifted = [];
      for (const [key, id] of Object.entries(L)) {
        const st = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0]?.state;
        if (st && !G.sameValue(st.settings.game, G.specOf(st.settings))) drifted.push(key);
      }
      check(!drifted.length, "the game-specs flag is on: every game still carries the spec its fields play", drifted.join());
    } else console.log("NOTE  the game-specs flag is off: the carried-spec checks were skipped");
    const alexErrors = errors.filter((e) => !/Failed to load resource/.test(e)).concat(errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
    const expected = (f) => /\/backstage\/members\/[^ ]*\/remove|\/leave|\b(403|409)\b/.test(f);
    check(!alexErrors.length || alexErrors.every((e) => /Failed to load resource/.test(e)), "no page errors (alex)", alexErrors.join(" | "));
    check(!failed.filter((f) => !expected(f)).length, "no failed requests the screens didn't mean", failed.filter((f) => !expected(f)).join(" | "));
    check(!j.errors.filter((e) => !/Failed to load resource/.test(e)).length, "no page errors (jordan)", j.errors.join(" | "));
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
