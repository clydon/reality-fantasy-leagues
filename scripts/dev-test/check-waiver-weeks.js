// Dev-only check that every waiver week's moves show where they happened (the user, 2026-10-31: the Episodes page only had each
// game's latest week, "0 moves", while the week with everyone's replacements was gone from it), in a real browser against the dev
// server, on new-fixture.js. It gives Weekly Lineup two past weeks (after Episode 3, alex and riley each replaced someone; after
// Episode 4, a quiet week where nobody moved) and runs Outlast's open week for real (alex replaces Carter):
//   - the API: every run you may see, oldest first; sam (on Episode 3) sees Weekly Lineup's Episode 3 week, not Outlast's
//     Episode 5 one;
//   - Episodes, as alex: a row for each week anyone moved in, just above the episode that opened it (Weekly Lineup's after
//     Episode 3, Outlast's after Episode 5), none for the quiet week; each says what you got, shows your swaps as faces, and
//     everyone else's in a line;
//   - a row opens that week's page: each player's moves as cards (who left → who came in, and how they've done since), whoever
//     made none in a line;
//   - nothing wider than the screen, no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-waiver-weeks.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. It shares
// the zt_nd_ fixture with the other check-new-* checks, so never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-waiver-weeks runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-waiver-weeks.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const firstName = (n) => n.split(" ")[0];

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
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[fx.users.alex, fx.users.sam]]);

    // ---- Weekly Lineup's past weeks: after Episode 3 alex and riley each replaced someone (jordan had no pick in); after Episode 4
    // nobody moved. Written into the league's own week list, before the week that's open. ----
    const lineup = (await pool.query("SELECT state FROM leagues WHERE id = $1", [L.lineup])).rows[0].state;
    const pid = (who) => lineup.players.find((p) => p.name === who).id;
    const outBy = (n) => lineup.castaways.filter((c) => c.status === "eliminated" && lineup.episodes.findIndex((e) => e.id === c.exitEpisodeId) + 1 <= n);
    const stillIn = lineup.castaways.filter((c) => c.status !== "eliminated");
    const gone = outBy(3);
    check(gone.length >= 2 && stillIn.length >= 3, "the fixture has castaways out by Episode 3 and free ones to bring in", `${gone.length} out, ${stillIn.length} in`);
    const [dropA, dropR] = [gone[0], gone[1] ?? gone[0]];
    const [addA, addR] = [stillIn[0], stillIn[1]];
    const at = (d) => new Date(Date.now() - d * 86400e3).toISOString();
    const week = (id, episode, results) => ({
      id, episode, openedAt: at(10 - episode), processAt: at(9 - episode), closesAt: at(8 - episode), phase: "closed", window: true, swaps: 1, addDrop: true, claimsIn: [], autoFills: [],
      run: { at: at(9 - episode), by: "schedule", orderBefore: [], orderAfter: [], results },
    });
    const past = [
      week("wv_zt_ep3", 3, [
        { playerId: pid("alex"), kind: "pickup", outcome: "got", castawayId: addA.id, droppedCastawayId: dropA.id, choice: 1, round: 1, passed: [] },
        { playerId: pid("riley"), kind: "pickup", outcome: "got", castawayId: addR.id, droppedCastawayId: dropR.id, choice: 1, round: 1, passed: [] },
        { playerId: pid("jordan"), kind: "pickup", outcome: "noClaim", passed: [] },
      ]),
      week("wv_zt_ep4", 4, [{ playerId: pid("alex"), kind: "addDrop", outcome: "noClaim", passed: [] }]),
    ];
    lineup.midSeason = lineup.midSeason || {};
    lineup.midSeason.waivers = lineup.midSeason.waivers || { periods: [] };
    lineup.midSeason.waivers.periods = [...past, ...lineup.midSeason.waivers.periods.filter((p) => p.episode > 4)];
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [L.lineup, JSON.stringify(lineup)]);

    // ---- Outlast's open week, for real: alex replaces Carter, and the Commissioner runs it ----
    const as = {};
    for (const who of ["alex", "sam"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const weeksOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/waivers${q}`)).body.games ?? [];
    const cup = (await weeksOf("alex")).find((w) => w.leagueId === L.outlast);
    const carter = cup.team.find((f) => f.name === "Carter Krull");
    const comesIn = cup.free[0];
    const saved = await as.alex.call("PUT", `/api/leagues/${L.outlast}/waivers/claims`, { pairs: [{ addId: comesIn.id, dropId: carter.id }] });
    check(saved.status === 200, "alex's claim for Carter is in", String(saved.status));
    const ran = await as.alex.call("POST", `/api/seasons/${sid}/backstage/waivers${q}`, { leagueId: L.outlast, action: "run" });
    check(ran.status === 200, "the Commissioner runs Outlast's waivers", `${ran.status} ${JSON.stringify(ran.body).slice(0, 160)}`);

    // ---- the API: every run you may see ----
    const alexWeeks = await weeksOf("alex");
    const wl = alexWeeks.find((w) => w.leagueId === L.lineup);
    const ol = alexWeeks.find((w) => w.leagueId === L.outlast);
    check(wl.runs.map((r) => r.episode).join() === "3,4", "Weekly Lineup: every week's run, oldest first (3, 4)", wl.runs.map((r) => r.episode).join());
    check(ol.runs.at(-1)?.episode === 5 && ol.run?.periodId === ol.runs.at(-1).periodId, "Outlast: the run after Episode 5, the week's own", JSON.stringify(ol.runs.map((r) => r.episode)));
    const samWeeks = await weeksOf("sam");
    check(
      samWeeks.find((w) => w.leagueId === L.lineup)?.runs.map((r) => r.episode).join() === "3" && !samWeeks.find((w) => w.leagueId === L.outlast)?.runs.some((r) => r.episode === 5),
      "sam (on Episode 3): Weekly Lineup's Episode 3 week, not what Episodes 4 and 5 opened",
      JSON.stringify(samWeeks.map((w) => [w.gameName, w.runs.map((r) => r.episode)]))
    );

    // ---- Episodes, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      })
    );
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    await page.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "networkidle" });
    await page.locator("[data-wv-ep=ran]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const rows = await page.locator("[data-wv-ep=ran]").evaluateAll((els) => els.map((e) => ({ ep: e.dataset.wvEpisode, text: e.innerText.replace(/\n/g, " | "), next: e.nextElementSibling?.getAttribute("data-ep") ?? e.parentElement?.nextElementSibling?.querySelector("[data-ep]")?.getAttribute("data-ep") ?? null })));
    check(rows.some((r) => r.ep === "3") && rows.some((r) => r.ep === "5"), "a row for each week anyone moved in: Weekly Lineup after Episode 3, Outlast after Episode 5", JSON.stringify(rows.map((r) => r.ep)));
    check(!rows.some((r) => r.ep === "4"), "none for the quiet week after Episode 4");
    const order = await page.evaluate(() => [...document.querySelectorAll("[data-wv-ep=ran], [data-ep]")].map((e) => (e.dataset.wvEpisode ? `w${e.dataset.wvEpisode}` : `e${e.dataset.ep}`)));
    const placed = (n) => order.indexOf(`w${n}`) >= 0 && order[order.indexOf(`w${n}`) + 1] === `e${n}`;
    check(placed(3) && placed(5), "each just above the episode that opened it", order.join(" "));
    const wlRow = rows.find((r) => r.ep === "3")?.text ?? "";
    check(new RegExp(`You got ${firstName(addA.name)} for ${firstName(dropA.name)}`).test(wlRow) && new RegExp(`riley got ${firstName(addR.name)} for ${firstName(dropR.name)}`).test(wlRow) && /2 moves/.test(wlRow), "Weekly Lineup's row: what you got, everyone else's in a line, 2 moves", wlRow);
    const olRow = rows.find((r) => r.ep === "5")?.text ?? "";
    check(new RegExp(`You got ${firstName(comesIn.name)}`).test(olRow) && /Outlast waivers/i.test(olRow), "Outlast's row: You got the one who came in for Carter", olRow);
    const wlEl = page.locator("[data-wv-ep=ran][data-wv-episode='3']");
    check((await wlEl.locator("img").count()) >= 1, "your swaps as faces on the row");
    await wlEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot("episodes-waiver-rows");
    await fits("Episodes with waiver rows");

    // ---- a row opens its week's page ----
    await wlEl.click();
    await page.locator("[data-wv-run-page]").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    const pageText = await page.locator("[data-wv-run-page]").innerText();
    check(/after Episode 3/i.test(await page.locator("[role=dialog][aria-hidden=false] h3").innerText()), "the page is that week's: after Episode 3");
    check((await page.locator("[data-wv-player=you] [data-wv-move]").count()) === 1 && (await page.locator("[data-wv-player=riley] [data-wv-move]").count()) === 1, "each player's moves as cards, you first");
    const card = await page.locator("[data-wv-player=you] [data-wv-move]").innerText();
    check(card.includes(firstName(dropA.name)) && card.includes(firstName(addA.name)) && /Out Ep \d/.test(card) && /(Still in|Out Ep \d)/.test(card.split(firstName(addA.name))[1] ?? ""), "a card: who left and when → who came in and how they've done since", card.replace(/\n/g, " | "));
    check(/No change: jordan \(no pick in\)/.test(pageText), "whoever made none, in a line", pageText.slice(-120));
    await shot("waiver-week-page");
    await fits("the week's page");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const ol5 = page.locator("[data-wv-ep=ran][data-wv-episode='5']");
    await ol5.scrollIntoViewIfNeeded();
    await ol5.click();
    await page.locator("[data-wv-run-page]").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    check(/after Episode 5/i.test(await page.locator("[role=dialog][aria-hidden=false] h3").innerText()) && (await page.locator("[data-wv-player=you] [data-wv-move]").innerText()).includes(firstName(comesIn.name)), "Outlast's row opens its own week: Carter → who came in");
    await shot("waiver-week-page-outlast");

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]|favicon\.ico/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
