// Dev-only check for the show space (docs/PLAN-new-design.md steps 0d and 1), in a real browser against the dev
// server, as new-fixture.js's alex (who plays all three games on the zt Survivor 51 and runs them):
//   - Set-up through the real endpoints: alex's Episode 6 lineup cleared (asked `?quiet`, so the answer is { ok },
//     never the league's state) and a prediction proposed for the next episode;
//   - Tonight: the phase heading from the schedule, one card per required move due in this couch's games (as
//     /api/me/home lists them), one yellow button, no dock before airtime;
//   - Your moves: a tab per game alex plays here plus Predictions; a lineup, a pick and a guess set in the sheet
//     and saved land in the leagues (the database, as the classic app reads them) and in /games; Tonight then shows
//     them as done cards after one "You're set"; Change opens the sheet again, and a changed lineup and guess
//     replace the old ones (one guess per person; "Will an idol be played?" is answered with Yes / No chips since step 12 part 2);
//   - the reminder ask (the 2026-10-26 critique's P0, the Fan Who Forgets' path; check-new-notify.js has the iPhone's and who it
//     skips): nothing reaches alex (no phone of his on), so his first save asks once with the notification he'd get; Not now
//     leaves a row under the heading; the next save doesn't ask; × closes the row for good; a move that slipped by (his Episode 5
//     pick taken out, at the end) brings it back once, saying so;
//   - Episodes: the dock (Set when moves are due, else Edit, with your starters' and your pick's faces), who's set,
//     an episode row opens its page (?page=epN) and back closes it; the dock holds still while the tabs move;
//   - Games: a real table per game, a row opens that person's sheet, Rules says each game's own rules, the How it
//     works row opens the page (the season's view model, real faces), whose jump bar scrolls to What scores;
//   - the hub's Up next: who's set, real;
//   - the guard: sam, behind on results (seen 3 of 5), gets no standings, exits or cast changes past Episode 3 from
//     /games or How it works, and their pick waits on revealing Episode 4 (its button is the reveal: check-new-reveal.js);
//   - Cast (real since step 3; check-new-stats.js checks its numbers): Faces, Rank and By episode switch, a face opens
//     their story, a re-sort runs Flip, ?rank=<stat> opens Rank;
//   - Chat: the messages and the composer, no dock;
//   - a show alex doesn't play (the fixture's Traitors): Play it in place of the tables, no dock;
//   - every show.* entry of the Preview registry (src/new/preview.ts) renders somewhere, a Preview tap says Coming
//     soon, nothing is wider than the screen, and no page errors.
// Screenshots of each tab (a screen at a time down the page), each sheet and page go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-show.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-show runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-show.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
// Pages pushed over the show used to have placeholders of their own; the drafts are real since step 7 (check-new-draft.js).
// Previews that only show where this fixture has nothing (none since step 13 part 3 made a planned night's Open real).
const ELSEWHERE = [];
const REQUIRED = ["lineup", "pickup", "pick", "draftTurn", "blindDraft"];
const BET = "Will an idol be played?";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new'), ($2, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex, fx.users.sam]);
    const stateOf = async (leagueId) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId])).rows[0].state;

    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    const hideBadge = () => {
      // Next's dev badge sits over the first tab.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    };
    await page.context().addInitScript(() => {
      window.__vt = [];
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (arg) {
          const entry = { nav: document.documentElement.dataset.nav || null, anims: [] };
          window.__vt.push(entry);
          const t = start.call(this, arg);
          t.ready.then(() => (entry.anims = document.documentElement.getAnimations({ subtree: true }).map((a) => a.effect?.pseudoElement || ""))).catch(() => {});
          return t;
        };
    });
    await page.context().addInitScript(hideBadge);

    const seen = new Set();
    const collect = async (p = page) => (await p.$$eval("[data-preview]", (els) => els.map((e) => e.dataset.preview))).forEach((id) => seen.add(id));
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    async function shoot(name, scroller = null, p = page) {
      const height = await p.evaluate((s) => (s ? document.querySelector(s).scrollHeight : document.documentElement.scrollHeight), scroller);
      for (let k = 0, y = 0; y < height - 120 && k < 8; k++, y += 760) {
        await p.evaluate(([s, top]) => (s ? (document.querySelector(s).scrollTop = top) : window.scrollTo(0, top)), [scroller, y]);
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(out, `${name}-${k}.png`) });
      }
      await p.evaluate((s) => (s ? (document.querySelector(s).scrollTop = 0) : window.scrollTo(0, 0)), scroller);
    }
    const tabTo = async (tab) => {
      await page.locator("nav[aria-label=Show] a", { hasText: new RegExp(`^${tab}`, "i") }).click();
      await page.waitForURL(`**/show/${sid}/${tab.toLowerCase()}`);
      await page.locator(`[data-tab=${tab.toLowerCase()}]`).waitFor();
      await page.waitForTimeout(700);
    };
    const closeSheet = async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    };
    const dialog = () => page.getByRole("dialog");
    // Save, then wait for the sheet to close (it closes once every write is in) and say what the toast says. The
    // toast's last words stay in the page after it slides away, so it's read, not waited for.
    const save = async () => {
      await dialog().getByRole("button", { name: "Save" }).click();
      // Your moves itself (the reminder ask's sheet can open as it goes).
      await dialog().filter({ hasText: "Your moves" }).waitFor({ state: "hidden", timeout: 15_000 });
      await page.waitForTimeout(600);
      return (await page.locator("[role=status]").textContent()) || "";
    };
    const json = async (res) => ({ status: res.status(), body: await res.json().catch(() => null) });

    // ---- set-up, through the real endpoints ----
    let home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const couch = [...home.couches].filter((c) => c.games.some((g) => g.seasonId === sid)).sort((x, y) => y.games.length - x.games.length)[0];
    const gamesUrl = `${BASE}/api/seasons/${sid}/games?couch=${couch.id}`;
    let play = (await (await page.request.get(gamesUrl)).json()).games;
    const lineupGame = play.find((g) => g.gameType === "active-roster");
    const poolGame = play.find((g) => g.gameType === "pickem");
    const outlastGame = play.find((g) => g.gameType === "classic-draft");
    check(play.length === 3 && !!lineupGame && !!poolGame && !!outlastGame, "/games: alex's three games on this couch", play.map((g) => g.gameName).join(", "));
    const cleared = await json(
      await page.request.put(`${BASE}/api/leagues/${lineupGame.leagueId}/episodes/${lineupGame.lineup.epId}/lineups/${lineupGame.playerId}?quiet`, { data: { castawayIds: [] } })
    );
    check(cleared.status === 200 && cleared.body && cleared.body.ok === true && !("castaways" in cleared.body), "a write asked ?quiet answers { ok }, not the league's state", JSON.stringify(cleared).slice(0, 120));
    const proposed = await page.request.post(`${BASE}/api/leagues/${outlastGame.leagueId}/episodes/upcoming/bets`, { data: { label: BET, points: 2 } });
    check(proposed.ok(), "a prediction proposed for the next episode", `${proposed.status()}`);

    // What the server says now: the moves due in this couch's games here, and the next episode.
    home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const space = await (await page.request.get(`${BASE}/api/seasons/${sid}/space?couch=${couch.id}`)).json();
    const mine = new Set(space.games.filter((g) => g.yourRole).map((g) => g.leagueId));
    const moves = home.moves.filter((m) => mine.has(m.leagueId));
    const required = moves.filter((m) => REQUIRED.includes(m.kind));
    const up = space.schedule?.upNext;
    check(required.some((m) => m.kind === "lineup") && required.some((m) => m.kind === "pick"), "the lineup and the pick are due", required.map((m) => m.kind).join(", "));

    // ---- Tonight ----
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    check(!!up && (await page.getByText(`Episode ${up.number}`, { exact: true }).first().isVisible()), `the heading is the next episode (${up && up.number})`);
    const cards = await page.locator("[data-move]").count();
    check(cards === required.length, `one card per required move due here (${required.length}: ${required.map((m) => m.kind).join(", ")})`, `${cards} cards`);
    check((await page.locator("[data-tab=tonight] .bg-chyron").count()) === 1, "one yellow button: the first card's");
    check((await page.locator(".nd-dock").count()) === 0, "no dock on Tonight before airtime");
    check((await page.locator("[data-game]").count()) === 3, "Your games: a card per game, real places");
    check(await page.getByText("Closes at airtime").first().isVisible(), "the prediction is an extra this week");
    await collect();
    await fits("Tonight");
    await shoot("tonight");

    // ---- Your moves: a lineup, a pick and a guess, saved ----
    await page.locator('[data-move^="lineup-"]').getByRole("button").click();
    await dialog().getByText("Your moves").waitFor();
    await page.waitForTimeout(500);
    const tabs = await dialog().getByRole("tab").allTextContents();
    check(tabs.join("|") === "Weekly Lineup|Survival Pool|Predictions|Outlast", "the sheet's tabs are the games alex plays here, and Predictions", tabs.join("|"));
    check((await dialog().getByRole("tab", { name: "Weekly Lineup" }).getAttribute("aria-selected")) === "true", "the lineup card opens it at Weekly Lineup");
    await page.screenshot({ path: path.join(out, "moves-lineup-empty.png") });
    const starters = dialog().locator("[data-starter]:not([disabled])");
    const picked = [];
    for (let i = 0; i < lineupGame.lineup.need; i++) {
      picked.push(await starters.nth(i).getAttribute("data-starter"));
      await starters.nth(i).click();
    }
    check((await dialog().locator('[data-starter][aria-pressed="true"]').count()) === lineupGame.lineup.need, `${lineupGame.lineup.need} starters chosen`);
    await page.screenshot({ path: path.join(out, "moves-lineup-set.png") });
    await dialog().getByRole("tab", { name: "Survival Pool" }).click();
    const pickBtn = dialog().locator("[data-pick]:not([disabled])").first();
    const pickId = await pickBtn.getAttribute("data-pick");
    await pickBtn.click();
    await page.screenshot({ path: path.join(out, "moves-pool.png") });
    await dialog().getByRole("tab", { name: "Predictions" }).click();
    await dialog().getByText(BET).waitFor();
    // A yes-or-no question's answers are chips (step 12 part 2).
    await dialog().locator('[data-guess-chip="Yes"]').first().click();
    await page.screenshot({ path: path.join(out, "moves-predict.png") });
    await dialog().getByRole("tab", { name: "Outlast" }).click();
    check(await dialog().getByText(/(Nothing to set|No lineup) in Outlast/).isVisible(), "Outlast's tab shows the team, no lineup to set");
    await page.screenshot({ path: path.join(out, "moves-outlast.png") });
    const said = await save();
    check(/^All set\. Change anything until/.test(said), "Save says All set", said);

    // ---- the reminder ask: no phone of alex's gets notifications, so his first save asks, once ----
    const ask = page.locator("[data-remind-sheet]");
    const remindRow = page.locator("[data-remind-row]");
    const remembered = () => page.evaluate((id) => JSON.parse(localStorage.getItem(`gys.remind.${id}`) || "{}"), fx.users.alex);
    await ask.waitFor({ timeout: 10_000 }).catch(() => {});
    check((await ask.getAttribute("data-remind-sheet").catch(() => null)) === "off", "the first save asks about notifications: Want a nudge?");
    const picture = (await page.locator("[data-remind-picture]").innerText().catch(() => "")) || "";
    check(
      new RegExp(`episode ${up.number + 1} airs in about 2 hours`).test(picture) && new RegExp(`Make your episode ${up.number + 1} pick`).test(picture),
      "its picture is the reminder he'd get next week, worded as db/reminders.js words it",
      picture.replace(/\s+/g, " ")
    );
    // Next week's 2-hours-before is this week's airtime less two hours on the clock, even across a clock change.
    const clock = await page.evaluate((at) => {
      const d = new Date(at);
      d.setHours(d.getHours() - 2);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "");
    }, up.airAt);
    check(picture.startsWith(clock), `the picture's clock: ${clock}, two hours before airtime`, picture.slice(0, 12));
    check((await remembered()).asked?.as === "off", "remembered on this phone: asked");
    await fits("the reminder ask");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, "remind-ask.png") });
    await page.locator("[data-remind-later]").click();
    await ask.waitFor({ state: "hidden", timeout: 10_000 });
    await remindRow.waitFor({ timeout: 10_000 }).catch(() => {});
    check(
      (await remindRow.getAttribute("data-remind-row").catch(() => null)) === "ask" &&
        (await page.evaluate(() => !!document.querySelector("[data-remind-row]")?.previousElementSibling?.matches("[data-phase]"))),
      "Not now: a quiet row right under the episode's heading"
    );
    check((await remindRow.locator(".bg-chyron").count()) === 0, "the row is outlined, not yellow (it's optional)");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, "remind-row.png") });

    const lineupState = await stateOf(lineupGame.leagueId);
    const ep6 = lineupState.episodes.find((e) => e.id === lineupGame.lineup.epId);
    check(JSON.stringify([...(ep6.lineups?.[lineupGame.playerId] ?? [])].sort()) === JSON.stringify([...picked].sort()), "the lineup is in the league (as classic reads it)", JSON.stringify(ep6.lineups?.[lineupGame.playerId]));
    const poolState = await stateOf(poolGame.leagueId);
    const pickEp = poolState.episodes.find((e) => e.id === poolGame.pick.epId);
    check((pickEp.picks || []).some((p) => p.playerId === poolGame.playerId && p.castawayId === pickId), "the pick is in the league");
    const bet = () => stateOf(outlastGame.leagueId).then((s) => s.episodes.flatMap((e) => e.bets || []).find((x) => x.label === BET));
    let guesses = (await bet()).predictions.filter((p) => p.playerId === outlastGame.playerId);
    check(guesses.length === 1 && guesses[0].guess === "Yes", "the guess is in the league", JSON.stringify(guesses));
    play = (await (await page.request.get(gamesUrl)).json()).games;
    const after = (type) => play.find((g) => g.gameType === type);
    check(after("active-roster").lineup.set && after("pickem").pick.pick === pickId && after("classic-draft").predictions[0]?.guess?.text === "Yes", "/games reads them back");

    // Tonight now: what's still due (the waiver pickup), then a done card each for the lineup and the pick.
    await page.locator("[data-done]").first().waitFor({ timeout: 10_000 });
    home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const left = home.moves.filter((m) => mine.has(m.leagueId) && REQUIRED.includes(m.kind));
    check(!left.some((m) => m.kind === "lineup" || m.kind === "pick"), "the lineup and the pick aren't due any more", left.map((m) => m.kind).join(", "));
    check((await page.locator("[data-move]").count()) === left.length, `the cards: what's still due (${left.map((m) => m.kind).join(", ") || "nothing"})`);
    if (!left.length) check(await page.getByText(/You're set for Episode/).first().isVisible(), "nothing due: You're set leads the cards");
    check((await page.locator("[data-done]").count()) === 2, "then a done card each for the lineup and the pick", `${await page.locator("[data-done]").count()}`);
    check((await page.locator("[data-tab=tonight] .bg-chyron").count()) === (left.length ? 1 : 0), "yellow only on what's still due");
    await shoot("tonight-done");

    // Change: bench one, start another, and change the guess.
    await page.locator('[data-done^="lineup-done"]').getByRole("button", { name: "Change" }).click();
    await dialog().getByText("Your moves").waitFor();
    await page.waitForTimeout(500);
    check((await dialog().getByRole("tab", { name: "Weekly Lineup" }).getAttribute("aria-selected")) === "true", "the lineup's Change opens Weekly Lineup");
    await dialog().locator(`[data-starter="${picked[0]}"]`).click();
    const bench = dialog().locator('[data-starter]:not([disabled])[aria-pressed="false"]');
    let swapped = null;
    for (let i = 0; i < (await bench.count()); i++) {
      const id = await bench.nth(i).getAttribute("data-starter");
      if (id !== picked[0]) {
        swapped = id;
        await bench.nth(i).click();
        break;
      }
    }
    await dialog().getByRole("tab", { name: "Predictions" }).click();
    await dialog().locator('[data-guess-chip="No"]').first().click();
    await save();
    await page.waitForTimeout(900);
    check((await ask.count()) === 0, "the second save doesn't ask again");
    await remindRow.locator("[data-remind-row-close]").click();
    await remindRow.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    check((await remindRow.count()) === 0 && !!(await remembered()).closed, "× closes the row, and it stays closed (on this phone)");
    const now = (await stateOf(lineupGame.leagueId)).episodes.find((e) => e.id === lineupGame.lineup.epId).lineups[lineupGame.playerId];
    check(!!swapped && now.includes(swapped) && !now.includes(picked[0]) && now.length === lineupGame.lineup.need, "a changed lineup replaces the old one", JSON.stringify(now));
    guesses = (await bet()).predictions.filter((p) => p.playerId === outlastGame.playerId);
    check(guesses.length === 1 && guesses[0].guess === "No", "a changed guess replaces the old one (one each)", JSON.stringify(guesses));

    // ---- Episodes ----
    await page.evaluate(() => (window.__vt.length = 0));
    await tabTo("Episodes");
    const dock = page.locator(".nd-dock");
    home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const due = home.moves.filter((m) => mine.has(m.leagueId)).length;
    check(await dock.isVisible(), "the dock sits over Episodes");
    check(((await dock.textContent()) || "").includes(due ? "Set" : "Edit"), `the dock says ${due ? "Set" : "Edit"} (${due} moves due)`, await dock.textContent());
    check((await dock.locator("img").count()) === lineupGame.lineup.need + 1, "the dock shows your starters and your pick", `${await dock.locator("img").count()} faces`);
    check(await page.getByText(/of 4 lineups set · \d of 4 picked/).isVisible(), "who's set this week, real");
    check(await page.getByText("you're on Ep 5").isVisible(), "the guard chip says where you are");
    await collect();
    await fits("Episodes");
    await shoot("episodes");
    await page.locator("[data-ep='4']").click();
    await page.waitForURL(/\?page=ep4/);
    await page.waitForTimeout(600);
    check(await page.locator('[data-episode-page]').isVisible(), "an episode row opens its page (real: who went home, your games)");
    await collect();
    await shoot("episode-4", "[role=dialog][aria-hidden=false]");
    await page.goBack();
    await page.waitForTimeout(600);
    check(!page.url().includes("page=") && !(await page.locator('[data-episode-page]').isVisible()), "back closes it");
    // The guard chip's Change: where you are (a later step).
    await page.getByRole("button", { name: /Spoiler-safe/ }).click();
    await page.waitForTimeout(400);
    await collect();
    await closeSheet();

    // ---- Games ----
    await tabTo("Games");
    const vt = await page.evaluate(() => window.__vt.at(-1) || null);
    check(!!vt && vt.anims.some((a) => a.includes("nd-dock")), "the dock holds still while the tabs move", JSON.stringify(vt));
    check((await page.locator("[data-table]").count()) === 3, "a real table per game");
    check((await page.locator("[data-table] [data-player]").count()) === 12, "four people on each", `${await page.locator("[data-table] [data-player]").count()}`);
    await collect();
    await fits("Games");
    await shoot("games");
    await page.locator("[data-player=riley]").first().click();
    await dialog().getByText(/of 4/).first().waitFor();
    await page.waitForTimeout(500);
    check(true, "a standings row opens that person's sheet");
    await page.screenshot({ path: path.join(out, "player-sheet.png") });
    await closeSheet();
    await page.locator(`[data-table="${lineupGame.leagueId}"]`).getByRole("button", { name: "Rules" }).click();
    await dialog().locator("ol").waitFor();
    await page.waitForTimeout(500);
    check(await dialog().getByText(/Only starters score/).isVisible(), "Rules says the game's own rules (its settings)");
    await page.screenshot({ path: path.join(out, "rules-sheet.png") });
    await closeSheet();
    await page.getByRole("button", { name: /^How .* works/ }).click();
    await page.waitForURL(/\?page=how-it-works/);
    await page.locator("[data-how] h2").first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(600);
    const howPage = page.locator("[role=dialog][aria-hidden=false]");
    check(await howPage.getByText("Each episode", { exact: true }).first().isVisible(), "How it works draws the season's rulebook");
    check((await howPage.locator("[data-how] img").count()) >= 18, "Who's playing: the season's real faces");
    await collect();
    await shoot("how-it-works", "[role=dialog][aria-hidden=false]");
    await howPage.locator("nav[aria-label='Jump to'] button").last().click();
    await page.waitForTimeout(900);
    const jumped = await page.evaluate(() => document.querySelector("[role=dialog][aria-hidden=false]").scrollTop);
    check(jumped > 400, "its jump bar scrolls the page", `${jumped}`);
    await collect();
    await page.goBack();
    await page.waitForTimeout(600);

    // ---- the hub: who's set on Up next, for the move on its plate (a pick's count beside a pick, since the 2026-10-26
    // critique; a lineup's when a lineup leads or nothing's due) ----
    await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    await page.locator("[data-hub]").waitFor({ timeout: 30_000 });
    home = await (await page.request.get(`${BASE}/api/me/home`)).json();
    const dueAt = (m) => (m.deadline ? Date.parse(m.deadline) : Infinity);
    const leadKind = home.moves.filter((m) => mine.has(m.leagueId)).sort((a, b) => dueAt(a) - dueAt(b))[0]?.kind ?? null;
    const progress = page.locator("[data-progress]");
    check(
      (await progress.count()) > 0 && (leadKind === "pick" ? /\d of 4 picked/ : /\d of 4 lineups set/).test((await progress.first().textContent()) || ""),
      `Up next: who's set, real, for the move on its plate (${leadKind ?? "nothing due"})`,
      (await progress.count()) ? await progress.first().textContent() : "none"
    );
    await page.screenshot({ path: path.join(out, "hub-upnext.png") });

    // ---- the guard: sam is behind (seen 3; results through 5) ----
    const s = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(s.close);
    await s.page.context().addInitScript(hideBadge);
    const samHome = await (await s.page.request.get(`${BASE}/api/me/home`)).json();
    const samCouch = samHome.couches.find((c) => c.games.some((g) => g.seasonId === sid));
    const samPlay = (await (await s.page.request.get(`${BASE}/api/seasons/${sid}/games?couch=${samCouch.id}`)).json()).games;
    check(samPlay.every((g) => g.through <= 3), "sam's standings stop at Episode 3", samPlay.map((g) => g.through).join(","));
    check(samPlay.every((g) => g.cast.every((c) => !c.out || c.out <= 3)), "nobody sam hasn't seen leave is out");
    check(samPlay.every((g) => g.table.every((r) => r.picks.every((p) => p.episode <= 3 || r.you))), "no pick past Episode 3 but sam's own");
    check(samPlay.every((g) => g.gameType === "classic-draft" || g.revealFirst === 4), "sam's lineup and pick wait on revealing Episode 4");
    const samHow = (await (await s.page.request.get(`${BASE}/api/seasons/${sid}/how-it-works?couch=${samCouch.id}`)).json()).how;
    check(samHow.season.you === 3, "How it works reads sam as on Episode 3", `${samHow.season.you}`);
    await s.page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await s.page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await s.page.waitForTimeout(800);
    // Step 2: a move that waits on results sam hasn't revealed says so, and its button is the reveal.
    const samCard = s.page.locator('[data-move^="pick-"]');
    check(/After you reveal Episode 4/.test((await samCard.textContent()) || "") && (await samCard.getByRole("button", { name: "Reveal Episode 4" }).count()) === 1, "sam's pick waits on revealing Episode 4, and its button reveals it");
    await s.page.screenshot({ path: path.join(out, "moves-reveal-first.png") });
    await s.close();
    closers.pop();

    // ---- Cast ----
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor();
    await tabTo("Cast");
    check((await page.locator("[data-cast]").count()) > 10, "Faces shows the cast");
    await collect();
    await fits("Cast");
    await shoot("cast-faces");
    await page.locator("[data-cast]").first().click();
    await dialog().getByText(/up to Episode/).waitFor();
    await page.waitForTimeout(400);
    check(true, "a face opens their story");
    await page.screenshot({ path: path.join(out, "cast-story.png") });
    await closeSheet();
    await page.locator("[data-view=rank]").click();
    await page.waitForTimeout(500);
    check(await page.getByText("Ranked by").isVisible(), "Rank switches in");
    await shoot("cast-rank");
    const firstRanked = () => page.locator("[data-cast]").first().getAttribute("data-cast");
    const top = await firstRanked();
    // The first stat (by its full name, from the rulebook) whose leader isn't the points leader.
    let sorted = null;
    for (const stat of (await page.locator('select[aria-label="Ranked by"] option').evaluateAll((os) => os.map((o) => o.value))).slice(1)) {
      await page.evaluate(() => (window.__vt.length = 0));
      await page.locator('select[aria-label="Ranked by"]').selectOption(stat);
      await page.waitForTimeout(700);
      sorted = await page.evaluate(() => window.__vt.at(-1) || null);
      if ((await firstRanked()) !== top) break;
    }
    check((await firstRanked()) !== top, "ranking by another stat re-sorts the cast", `${top} stayed first`);
    check(!!sorted && sorted.anims.some((a) => a.includes("nd-flip")), "each face moves to its new place (Flip)", JSON.stringify(sorted && sorted.anims.slice(0, 4)));
    await page.locator("[data-view=heat]").click();
    await page.waitForTimeout(500);
    check(await page.locator("table").isVisible(), "By episode switches in");
    await fits("Cast, By episode");
    await page.screenshot({ path: path.join(out, "cast-heat.png") });
    await page.goto(`${BASE}/show/${sid}/cast?rank=votedWithMajority`, { waitUntil: "networkidle" });
    await page.locator("[data-rank]").waitFor();
    check((await page.locator("[data-view=rank]").getAttribute("aria-selected")) === "true", "?rank= opens Rank (the stats page's link)");

    // ---- Chat ----
    await tabTo("Chat");
    check(await page.getByPlaceholder(/Message the/).waitFor({ timeout: 20_000 }).then(() => true, () => false), "Chat has its composer");
    check((await page.locator(".nd-dock").count()) === 0, "no dock on Chat");
    await collect();
    await fits("Chat");
    await shoot("chat");

    // ---- a show alex doesn't play: Play it, and no dock ----
    await page.goto(`${BASE}/show/${fx.traitorsSeasonId}/games`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=games]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    check(await page.locator('[data-play-it="play"]').isVisible(), "a show you don't play: Play it, in place of the tables");
    check((await page.locator(".nd-dock").count()) === 0 && (await page.locator("[data-table]").count()) === 0, "no tables and no dock there");
    await collect();
    await fits("Games, a show you don't play");
    await page.screenshot({ path: path.join(out, "games-not-playing.png") });
    // How it works for a show nobody here plays: the season's own rulebook.
    await page.getByRole("button", { name: /^How .* works/ }).click();
    await page.locator("[data-how] h2").first().waitFor({ timeout: 15_000 });
    check(await page.locator("[role=dialog][aria-hidden=false]").getByText("What scores", { exact: true }).first().isVisible(), "How it works for a show nobody plays: the season's rulebook");
    await page.goBack();
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor();

    // ---- the ⋯ menu's rows, then every show entry ----
    await page.getByRole("button", { name: "Show menu" }).click();
    await dialog().getByText("How it works").waitFor();
    await page.waitForTimeout(400);
    await collect();
    await closeSheet();
    const missing = Object.keys(PREVIEWS).filter((id) => id.startsWith("show.") && !ELSEWHERE.includes(id) && !seen.has(id));
    check(missing.length === 0, "every show.* Preview entry renders", missing.join(", "));

    // ---- a move that slipped by: alex's Episode 5 pick taken out (last: it resets his streak), and the closed row comes back
    // once, saying so ----
    const ps = await stateOf(poolGame.leagueId);
    const e5 = ps.episodes.find((e) => e.number === 5);
    e5.picks = (e5.picks || []).filter((p) => p.playerId !== poolGame.playerId);
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [poolGame.leagueId, JSON.stringify(ps)]);
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await remindRow.waitFor({ timeout: 15_000 }).catch(() => {});
    const slipped = (await remindRow.innerText().catch(() => "")) || "";
    check(
      (await remindRow.getAttribute("data-remind-row").catch(() => null)) === "slipped" && /Episode 5's pick slipped by/.test(slipped) && new RegExp(`before Episode ${up.number} locks`).test(slipped),
      "his Episode 5 pick never came in: the row is back, once, saying so",
      slipped.replace(/\s+/g, " ")
    );
    await fits("Tonight with the slipped-by row");
    await page.screenshot({ path: path.join(out, "remind-slipped.png") });
    await remindRow.locator("[data-remind-row-close]").click();
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-tab=tonight]").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    check((await remindRow.count()) === 0 && (await remembered()).slipped?.key === `${sid}:5`, "closed: it doesn't come back for that miss");

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    for (const close of closers.reverse()) await close().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
