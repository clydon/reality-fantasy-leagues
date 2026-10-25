// Dev-only check for step 2 (docs/PLAN-new-design.md): episodes, results in stages and the one reveal, in a real
// browser against the dev server, on new-fixture.js's couch (three linked leagues on a zt Survivor 51, results
// through Episode 5, Episode 6 in three days):
//   1. Results in: alex is set back to Episode 4. Tonight says "Results are in" with the one yellow (Reveal), a move
//      that waits on them says "After you reveal Episode 5"; Episodes has the plate, a hidden row and the seen
//      episodes (an episode page opens with who went home and your games); Games says "As of Episode 4"; the dock
//      and the show bar say so too.
//   2. The reveal: Reveal plays the beats (opener, who went home, your lineup, your other games, the table moving),
//      and moves alex to Episode 5 in every league of theirs on the season (the other couch's too) and in
//      show_follows, with one chat line per chat; Share your night leaves out who went home until switched on, posts
//      to the couch, and saves the card as an image; back, Tonight has Episode 5's recap.
//   3. Stages: Episode 5 at the early stage (only who went home: its scoring moments held back) reveals with Weekly
//      Lineup "so far" and the pool's table; show_follows.early_seen and early_night (step 8: the so-far total, the
//      starters and the table) wait on it; once final, Tonight's morning update and the dock say "Final scores are in",
//      and the dock's See opens the morning update's sheet: so far last night against the final (as Episodes counts it),
//      who added what this morning, the table; seeing it clears both.
//   4. Waiting: with Episode 6 aired and no results, Tonight, Episodes and the dock say "Waiting for results".
//   5. The guard: sam (seen 3) gets nothing past Episode 3 from /episodes, can't reveal past Episode 4, and gets
//      Episode 4's beats from revealing it. A show alex doesn't play answers with nothing to reveal.
// Screenshots of each state and beat go to <outDir>. Nothing wider than the screen; no page errors.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-reveal.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-reveal runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-reveal.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

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
    const L = fx.leagues;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new'), ($2, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex, fx.users.sam]);
    const backTo = async (who, n) => {
      await pool.query("UPDATE league_memberships SET results_seen_through = $2 WHERE user_id = $1", [fx.users[who], n]);
      await pool.query("UPDATE show_follows SET seen_through = $3, early_seen = NULL WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    };
    const marks = async (who) => (await pool.query("SELECT league_id, results_seen_through AS n FROM league_memberships WHERE user_id = $1", [fx.users[who]])).rows;
    const follow = async (who) => (await pool.query("SELECT seen_through, early_seen FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid])).rows[0];
    // Episode 5's stage in the lineup league: early (only who went home) or final.
    // Early holds the episode's scoring moments back (only who went home is in); final puts them back.
    let heldBack = null;
    const stage5 = async (stage) => {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [L.lineup]);
      const s = rows[0].state;
      const ep = s.episodes.find((e) => e.number === 5);
      if (stage === "early") {
        ep.resultsStage = "early";
        if (!heldBack) [heldBack, ep.scoringEvents] = [ep.scoringEvents || [], []];
      } else {
        delete ep.resultsStage;
        if (heldBack) [ep.scoringEvents, heldBack] = [heldBack, null];
      }
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [L.lineup, JSON.stringify(s)]);
    };
    await backTo("alex", 4);

    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
      // A phone's share sheet: record what Share image hands it.
      window.__shared = [];
      navigator.canShare = () => true;
      navigator.share = async (d) => {
        for (const f of d.files || []) window.__shared.push({ name: f.name, type: f.type, size: f.size });
      };
    });
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
    const go = async (tab) => {
      await page.goto(`${BASE}/show/${sid}/${tab}`, { waitUntil: "networkidle" });
      await page.locator(`[data-tab=${tab}]`).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(900);
    };
    const text = async (sel) => ((await page.locator(sel).first().textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    const reveal = page.locator("[role=dialog][aria-label='The reveal']");
    /** Taps through the beats to the last, screenshotting each; returns the beats seen. */
    const beatText = {};
    const playBeats = async (name) => {
      const beats = [];
      await reveal.locator("[data-beat]").first().waitFor({ timeout: 20_000 });
      for (let k = 0; k < 10; k++) {
        await page.waitForTimeout(900);
        const beat = await reveal.locator("[data-beat]").getAttribute("data-beat");
        beats.push(beat);
        beatText[beat] = await text("[data-beat]");
        await shot(`${name}-${k}-${beat}`);
        if ((await reveal.getByRole("button", { name: /^Back to / }).count()) && (await reveal.getByRole("button", { name: /^Back to / }).isVisible())) break;
        await reveal.locator("[data-stage]").click();
      }
      return beats;
    };
    const backFromReveal = async () => {
      await reveal.getByRole("button", { name: /^Back to / }).click();
      await page.waitForTimeout(900);
    };
    const chatLines = async (type) => (await pool.query("SELECT league_id, text FROM chat_messages WHERE user_id = $1 AND type = $2", [fx.users.alex, type])).rows;

    // ---- 1. results in ----
    await go("tonight");
    check(await page.locator("[data-results-in='5']").isVisible(), "Tonight: Episode 5's results are in");
    check(/Episode 5/.test(await text("[data-tab=tonight] b.type-caption")) && (await page.getByText("Results", { exact: true }).first().isVisible()), "the heading is Episode 5 · Results");
    check((await page.locator("[data-tab=tonight] button.bg-chyron").count()) === 1, "one yellow: Reveal", `${await page.locator("[data-tab=tonight] button.bg-chyron").count()}`);
    const pickCard = page.locator('[data-move^="pick-"]');
    check((await pickCard.count()) > 0 && /After you reveal Episode 5/.test(await text('[data-move^="pick-"]')), "a move that waits on the results says so (noticed in step 1)", await text('[data-move^="pick-"]'));
    check(/Ep 5 results are in/.test(await text("header, [class*=nd-showbar]")) || (await page.getByText("Ep 5 results are in").first().isVisible()), "the show bar says results are in");
    await fits("Tonight, results in");
    await shot("1-tonight-results-in");

    await go("episodes");
    check(await page.locator("[data-reveal-plate]").isVisible(), "Episodes: the results-in plate");
    check(await page.locator("[data-ep-hidden='5']").isVisible(), "Episode 5's row is hidden until you reveal");
    check((await page.locator("[data-ep]").count()) === 4, "Episodes 1 to 4 as seen rows", `${await page.locator("[data-ep]").count()}`);
    check((await page.locator("[data-dock=reveal]").count()) === 1, "the dock says Reveal");
    await fits("Episodes, results in");
    await shot("1-episodes-results-in");
    await page.locator("[data-ep='4']").click();
    await page.locator("[data-episode-page='4']").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    const ep4 = await text("[data-episode-page='4']");
    check(/Brady Booker/.test(ep4) && /Your games/.test(ep4) && /Weekly Lineup/.test(ep4), "an episode page: who went home and your games", ep4.slice(0, 120));
    await shot("1-episode-4");
    await page.goBack();
    await page.waitForTimeout(600);

    await go("games");
    check(await page.locator("[data-as-of='5']").isVisible() && /As of Episode 4/.test(await text("[data-as-of='5']")), "Games: As of Episode 4, reveal to update");
    await shot("1-games-as-of");

    // ---- 2. the reveal ----
    await go("tonight");
    await page.locator("[data-results-in='5']").getByRole("button", { name: /Reveal Episode 5/ }).click();
    await page.waitForURL(/\?page=reveal/);
    const beats = await playBeats("2-beat");
    check(beats[0] === "open" && beats.includes("out") && beats.includes("lineup") && beats.includes("games") && beats.at(-1) === "table", "the beats: opener, who went home, lineup, other games, the table", beats.join(" > "));
    await page.waitForTimeout(800);
    check((await reveal.locator("[data-table-move=after]").count()) === 1, "the table moves to after the episode");
    const after = await marks("alex");
    check(after.every((m) => m.n === 5), "alex is on Episode 5 in every league on the season, the other couch's too", JSON.stringify(after.map((m) => m.n)));
    check((await follow("alex")).seen_through === 5, "show_follows moved to 5");
    const lines = await chatLines("reveal");
    check(lines.length === 2 && lines.some((l) => l.league_id === L.extra), "one 'revealed episode 5' line per chat (the linked group's, the other couch's)", JSON.stringify(lines.map((l) => l.text)));

    await reveal.getByRole("button", { name: "Share your night" }).click();
    const sheet = page.getByRole("dialog").filter({ hasText: "Share your night" });
    await sheet.locator("[data-share-card]").waitFor();
    await page.waitForTimeout(500);
    check(!/Carter/.test(await text("[data-share-card]")), "the card leaves out who went home by default");
    await shot("2-share-off");
    await sheet.getByRole("switch").click();
    await page.waitForTimeout(300);
    check(/Carter Krull/.test(await text("[data-share-out]")), "Say who went home puts them on the card");
    await shot("2-share-on");
    await sheet.getByRole("button", { name: "Share image" }).click();
    await page.waitForTimeout(1500);
    const shared = await page.evaluate(() => window.__shared);
    check(shared.length === 1 && shared[0].type === "image/png" && shared[0].size > 20_000, "Share image hands the phone's share sheet the card as a PNG", JSON.stringify(shared));
    await sheet.getByRole("switch").click();
    await sheet.getByRole("button", { name: "Post to the couch" }).click();
    await page.waitForTimeout(1200);
    const posts = await chatLines("message");
    check(posts.length === 1 && !/Carter/.test(posts[0].text) && /Episode 5/.test(posts[0].text), "Post to the couch: one message, no spoiler", JSON.stringify(posts.map((p) => p.text)));
    await backFromReveal();
    check(!page.url().includes("page=reveal"), "Back closes the reveal");
    await page.locator("[data-last-time='5']").waitFor({ timeout: 10_000 });
    check(/Carter Krull/.test(await text("[data-last-time='5']")) && (await page.locator("[data-results-in]").count()) === 0, "Tonight: Episode 5's recap, no reveal left");
    await fits("Tonight, after the reveal");
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("2-tonight-after");

    // ---- 3. stages: early, then the morning update ----
    await backTo("alex", 4);
    await stage5("early");
    await go("tonight");
    check(/Early results are in/.test(await text("[data-results-in='5']")) && (await page.locator("[data-stage-bar=early]").isVisible()), "early: Early results are in, with the stage bar");
    await shot("3-tonight-early");
    await page.locator("[data-results-in='5']").getByRole("button", { name: /Reveal Episode 5/ }).click();
    const early = await playBeats("3-beat");
    const lineupBeat = early.includes("lineup");
    check(lineupBeat, "the early reveal still shows your lineup");
    check(/Survival Pool standings/.test(await text("[data-beat=table]")), "early: the pool's table moves, not the lineup's", await text("[data-beat=table]"));
    await backFromReveal();
    check((await follow("alex")).early_seen === 5, "show_follows.early_seen waits on Episode 5's final scores");
    const night = (await pool.query("SELECT early_night FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.alex, sid])).rows[0].early_night;
    const soFarShown = Number((/([+−-]?\d+(?:\.\d+)?)\s*so far/.exec(beatText.lineup || "") || [])[1]?.replace("−", "-"));
    check(!!night && night.leagueId === L.lineup && night.total === soFarShown && night.table.length === 4, "and early_night keeps the so-far total the reveal showed, its starters and the table", JSON.stringify([night && night.total, soFarShown, beatText.lineup]));
    check((await page.locator("[data-morning]").count()) === 0, "no morning update while it's still early");
    await stage5("final");
    await go("tonight");
    check(await page.locator("[data-morning='5']").isVisible(), "final now: the morning update says Final scores are in");
    await shot("3-tonight-morning");
    await go("episodes");
    check((await page.locator("[data-dock=final]").count()) === 1, "the dock says Final scores are in");
    await page.locator("[data-dock=final]").click();
    const morning = page.locator("[data-morning-sheet='5']");
    await morning.locator("[data-morning-row]").first().waitFor({ timeout: 20_000 });
    check((await reveal.isVisible()) === false, "the morning update is a sheet, not the reveal again");
    const soFar = Number(await morning.locator("[data-so-far]").getAttribute("data-so-far"));
    const finalTotal = Number(await morning.locator("[data-final-total]").getAttribute("data-final-total"));
    // Episodes' line for Episode 5 in Weekly Lineup, now final: what the sheet's Final should say.
    const epRows = await page.evaluate(async ([s, c]) => (await (await fetch(`/api/seasons/${s}/episodes?couch=${c}`)).json()).episodes, [sid, fx.couchId]);
    const lineupLine = epRows.find((e) => e.number === 5)?.lines?.find((l) => l.gameType === "active-roster");
    const counted = Number(String(lineupLine?.big ?? "").replace("−", "-").replace("+", ""));
    check(soFar === night.total && finalTotal === counted && finalTotal !== soFar, "So far last night against Final: the early total, then every point (as Episodes counts it)", JSON.stringify([soFar, finalTotal, lineupLine]));
    check((await morning.locator("[data-added]").count()) >= 1, "who added what this morning");
    check((await morning.locator("[data-morning-row]").count()) === 4, "and the Weekly Lineup table");
    await fits("the morning update");
    await shot("3-morning-sheet");
    await morning.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(700);
    const cleared = (await pool.query("SELECT early_seen, early_night FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.alex, sid])).rows[0];
    check(cleared.early_seen === null && cleared.early_night === null, "seeing the final scores clears it, early night and all");
    await go("tonight");
    check((await page.locator("[data-morning]").count()) === 0, "and the morning update is gone");

    // ---- 4. waiting: Episode 6 aired with nothing in ----
    // Five days back: Episode 6 aired two days ago (four could land on tonight's airtime, and it'd be on air).
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
    await go("tonight");
    check(await page.locator("[data-waiting='6']").isVisible() && (await page.locator("[data-stage-bar=waiting]").isVisible()), "Tonight: Episode 6 is waiting for results");
    await shot("4-tonight-waiting");
    await go("episodes");
    check(await page.locator("[data-ep-waiting='6']").isVisible(), "Episodes: a waiting row for Episode 6");
    check((await page.locator("[data-dock=waiting]").count()) === 1, "the dock says it just aired");
    await shot("4-episodes-waiting");
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date + 5 WHERE id = $1", [sid]);

    // ---- 5. the guard ----
    const s = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(s.close);
    const samEps = await (await s.page.request.get(`${BASE}/api/seasons/${sid}/episodes?couch=${fx.couchId}`)).json();
    const seenNums = samEps.episodes.filter((e) => e.status === "seen").map((e) => e.number);
    check(seenNums.every((n) => n <= 3) && samEps.reveal?.episode === 4, "sam (seen 3): nothing past Episode 3, Episode 4 is next to reveal", JSON.stringify({ seenNums, reveal: samEps.reveal }));
    check(samEps.episodes.filter((e) => e.status === "hidden").every((e) => !e.out && !e.lines), "a hidden episode says nothing but that it's in");
    const skip = await s.page.request.post(`${BASE}/api/seasons/${sid}/reveal`, { data: { episode: 6, couch: fx.couchId } });
    check(skip.status() === 400, "nothing to reveal past the latest results", `${skip.status()}`);
    const r4 = await (await s.page.request.post(`${BASE}/api/seasons/${sid}/reveal`, { data: { episode: 4, couch: fx.couchId } })).json();
    check(r4.episode === 4 && r4.out.length === 1 && r4.out[0].name === "Brady Booker" && r4.next === 5, "sam's reveal of Episode 4: Brady went home, Episode 5 next", JSON.stringify({ out: r4.out.map((o) => o.name), next: r4.next }));
    const notMine = await b.page.request.get(`${BASE}/api/seasons/${fx.traitorsSeasonId}/episodes`);
    check(notMine.ok() && (await notMine.json()).reveal === null, "a show alex doesn't play: episodes, nothing to reveal");

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
