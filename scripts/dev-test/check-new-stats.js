// Dev-only check for the cast explorer and stats (docs/PLAN-new-design.md step 3), against the dev server, on
// new-fixture.js (a zt Survivor 51 whose accepted results are its lineup league's, and a zt Traitors whose cast
// carries the faction as its tribe):
//   - GET /api/seasons/[id]/stats: every count is the season's accepted results up to where you are (the database's
//     own rows, counted here), points match the couch's Weekly Lineup (/games' cast points), a range counts only its
//     episodes and is clamped to where you are, the stats are named from the rulebook (Points first);
//   - the guard: sam (on 3 of 5) gets nothing past Episode 3; riley (on 2 of the Traitors) gets no groups (the faction
//     is a secret role, never a filter), no role and no role-revealing result for anyone still in, a role for
//     someone banished; jordan (on 4, privately) sees through 3; casey (not following) nothing; a couch you're not on
//     is refused; a show you don't play has each episode's who went home and what happened; a result accepted since
//     is counted on the next read;
//   - the Cast tab at 390 as alex: Faces by tribe (and Out), Your team, a face's story, Rank by a stat by its full
//     name, a pattern, the episode slider (a range asks again, By episode shows its columns), Compare two, Share
//     (posted to the couch's chat), ?rank= and &from=&to=;
//   - Tonight's Stats card: the stat of the week opens the stats page at it, sorted, which links into Rank; All N stats;
//   - the hub's By the numbers: real stat cards and rows, a row opens that show's stats page over the hub, back
//     returns to By the numbers; the couch accolades are the only Preview there;
//   - sam's slider stops at 3; riley's Traitors Cast groups Still in / Out with a role on the banished;
//   - nothing wider than the screen, no page errors.
// Screenshots of each go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-stats.js <outDir> [--width=390] [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-stats runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-stats.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** Each castaway's recorded events in Episodes from..to, from the season's accepted rows: name -> type -> n. */
async function countsFromDb(pool, seasonId, from, to) {
  const { rows } = await pool.query(
    `SELECT castaway_name AS name, event_type AS type, count(*)::int AS n FROM season_decisions
      WHERE season_id = $1 AND status = 'accepted' AND kind = 'event' AND episode_number BETWEEN $2 AND $3 GROUP BY 1, 2`,
    [seasonId, from, to]
  );
  const by = new Map();
  for (const r of rows) by.set(r.name, { ...(by.get(r.name) || {}), [r.type]: r.n });
  return by;
}

const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new'), ($2, 'new'), ($3, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [
      fx.users.alex, fx.users.sam, fx.users.riley,
    ]);
    const as = {};
    for (const who of ["alex", "sam", "riley", "jordan", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const stats = async (who, season, q = "") => as[who].call("GET", `/api/seasons/${season}/stats${q}`);

    // ---- the counts, against the database ----
    const { status, body: a } = await stats("alex", sid, `?couch=${fx.couchId}`);
    check(status === 200 && a.through === 5 && a.from === 1 && a.to === 5, "alex: counted through Episode 5, all of it", `${status} ${a && a.through}`);
    check(a.stats[0].key === "points" && a.stats.some((s) => s.name === "Voted with the majority") && a.stats.every((s) => s.name && !/^[a-z]+[A-Z]/.test(s.name)), "the stats by their full names from the rulebook, Points first", a.stats.map((s) => s.name).join(" | "));
    check(a.groups.map((g) => g.name).join() === "Toka,Savu,Dina" && a.groupWord === "tribe" && !a.roles, "groups: the three tribes people are on now", JSON.stringify(a.groups));
    const db5 = await countsFromDb(pool, sid, 1, 5);
    const wrong = a.cast.filter((c) => !same(c.counts, db5.get(c.name) || {}));
    check(wrong.length === 0, "every count is the season's accepted results through 5", wrong.slice(0, 2).map((c) => `${c.name} ${JSON.stringify(c.counts)} vs ${JSON.stringify(db5.get(c.name))}`).join("; "));
    const outs = (await pool.query(`SELECT castaway_name AS name, episode_number AS n FROM season_decisions WHERE season_id = $1 AND kind = 'elimination'`, [sid])).rows;
    check(outs.every((o) => a.cast.find((c) => c.name === o.name)?.out === o.n), "who's out, and when, is the season's eliminations");
    const lineup = (await as.alex.call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games.find((g) => g.gameType === "active-roster");
    const off = lineup.cast.filter((c) => Math.abs((a.cast.find((x) => x.name === c.name)?.points ?? NaN) - c.points) > 0.001);
    check(a.pointsFrom === "Lineup League" && off.length === 0, "points are the couch's Weekly Lineup's (/games' cast points)", off.slice(0, 2).map((c) => `${c.name} ${c.points}`).join("; "));
    check(a.featured.length >= 3 && a.featured.every((k) => a.stats.some((s) => s.key === k)) && a.patterns.length >= 1, "a stat of the week, two more, and patterns", JSON.stringify(a.featured.slice(0, 3)));

    const r = (await stats("alex", sid, `?couch=${fx.couchId}&from=2&to=3`)).body;
    const db23 = await countsFromDb(pool, sid, 2, 3);
    check(r.from === 2 && r.to === 3 && r.cast.every((c) => same(c.counts, db23.get(c.name) || {}) && c.perEp.length === 2), "Episodes 2–3: only their results, a column each", `${r.from}-${r.to}`);
    const clamped = (await stats("alex", sid, "?from=0&to=99")).body;
    check(clamped.from === 1 && clamped.to === 5, "a range past where you are is clamped to it", `${clamped.from}-${clamped.to}`);

    // ---- the guard ----
    const s = (await stats("sam", sid)).body;
    const db3 = await countsFromDb(pool, sid, 1, 3);
    check(s.through === 3 && s.seenThrough === 3 && s.cast.every((c) => (c.out === null || c.out <= 3) && same(c.counts, db3.get(c.name) || {})), "sam (on 3): nothing past Episode 3", `through ${s.through}`);
    check((await stats("sam", sid, "?from=4&to=5")).body.to === 3, "sam asking for Episodes 4–5 gets 3");
    const t = (await stats("riley", tid)).body;
    const still = t.cast.filter((c) => c.out === null);
    const hana = t.cast.find((c) => c.name === "Hana Kim");
    const ivo = t.cast.find((c) => c.name === "Ivo Petrov");
    check(t.through === 2 && t.groups.length === 0 && t.roles && still.every((c) => c.group === null && c.start === null), "riley (Traitors, on 2): no groups, the faction is a secret role", JSON.stringify(t.groups));
    check(!JSON.stringify(still).includes("Traitor") && !hana.counts.turnedOnTraitor && !t.stats.some((x) => x.key === "turnedOnTraitor"), "nobody still in has a role, or a result that gives one away", JSON.stringify(hana));
    check(ivo.out === 2 && ivo.role === "Traitor" && t.cast.find((c) => c.name === "Bea Lund").role === "Faithful", "someone who's left has their role", JSON.stringify(ivo));
    check(t.cast.find((c) => c.name === "Cal Ortiz").out === null && !t.cast.find((c) => c.name === "Eli Park").counts.shieldWon, "nothing from Episode 3 (Cal's murder, Eli's shield)");
    const j = (await stats("jordan", tid)).body;
    check(j.through === 3 && j.seenThrough === 4 && j.cast.find((c) => c.name === "Cal Ortiz").out === 3, "jordan (on 4, privately): through 3, the last with results");
    const c0 = (await stats("casey", tid)).body;
    check(c0.through === 0 && c0.cast.every((c) => !Object.keys(c.counts).length && c.out === null), "casey (not following): nothing counted");
    check((await stats("casey", sid, `?couch=${fx.couchId}`)).status >= 400, "a couch you're not on is refused");
    const eps = (await as.riley.call("GET", `/api/seasons/${tid}/episodes`)).body.episodes;
    const ep2 = eps.find((e) => e.number === 2);
    check(
      eps.length === 2 && ep2.out.some((o) => o.name === "Ivo Petrov") && ep2.happened.some((h) => h.label === "Shield" && h.winners.some((w) => w.name === "Cal")),
      "a show you don't play: each episode's who went home and what happened",
      JSON.stringify(ep2)
    );
    // The season's results are kept per server while unchanged: one accepted since is counted on the next read.
    await pool.query(`INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, event_type, status, decided_at) VALUES ($1, 2, 'event', 'Ada Moss', 'shieldWon', 'accepted', now())`, [tid]);
    check((await stats("riley", tid)).body.cast.find((c) => c.name === "Ada Moss").counts.shieldWon === 1, "a result accepted since is counted on the next read");
    await pool.query(`DELETE FROM season_decisions WHERE season_id = $1 AND castaway_name = 'Ada Moss' AND event_type = 'shieldWon'`, [tid]);
    check((await stats("alex", "00000000-0000-4000-8000-000000000000")).status === 404, "an unknown season is 404");

    // ---- the Cast tab, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      })
    );
    const fits = async (where, p = page) => {
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    const shot = (name, p = page) => p.screenshot({ path: path.join(out, `${name}.png`) });
    const dialog = (p = page) => p.locator("[role=dialog]:visible").last();
    const closeSheet = async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    };
    const statsCalls = [];
    page.on("request", (req) => req.url().includes("/stats") && statsCalls.push(req.url()));

    await page.goto(`${BASE}/show/${sid}/cast`, { waitUntil: "networkidle" });
    await page.locator("[data-explorer]").waitFor({ timeout: 30_000 });
    check((await page.locator("[data-preview]").count()) === 0, "the Cast tab has no Preview left");
    check((await page.locator("[data-group]").evaluateAll((els) => els.map((e) => e.dataset.group))).join() === "Toka,Savu,Dina,Out", "Faces: by tribe, then Out");
    check((await page.locator("[data-cast]").count()) === 18, "Faces shows the whole cast");
    check((await page.getByText("Your team").count()) > 0, "alex's castaways say Your team");
    check(/Out · Ep 5/.test((await page.locator('[data-group="Out"]').textContent()) || ""), "who's out says when");
    await fits("Cast, Faces");
    await shot("cast-faces");
    await page.locator('[data-group="Toka"] [data-cast]').first().click();
    await page.locator("[data-story]").waitFor();
    await page.waitForTimeout(400);
    check(/up to Episode 5/.test((await dialog().textContent()) || "") && (await page.locator("[data-story] .type-num.grid").count()) === 5, "a face opens their story, an episode a row");
    await shot("cast-story");
    await closeSheet();

    await page.locator("[data-view=rank]").click();
    await page.waitForTimeout(400);
    const firstRanked = () => page.locator("[data-rank] [data-cast]").first().getAttribute("data-cast");
    const topPoints = await firstRanked();
    check((await page.locator("[data-points-from]").innerText()) === "Points as Lineup League counts them", "Rank by points says whose points they are");
    await page.locator('select[aria-label="Ranked by"]').selectOption("votedWithMajority");
    await page.waitForTimeout(600);
    check((await page.locator("[data-rank]").getAttribute("data-rank")) === "votedWithMajority" && (await page.locator('select[aria-label="Ranked by"]').locator("option:checked").textContent()) === "Voted with the majority", "Rank by a stat's full name");
    const leader = a.cast.filter((c) => c.out === null).sort((x, y) => (y.counts.votedWithMajority || 0) - (x.counts.votedWithMajority || 0))[0];
    check((await firstRanked()) === leader.first || (leader.counts.votedWithMajority || 0) === (a.cast.find((c) => c.first === (topPoints)).counts.votedWithMajority || 0), "the most votes with the majority leads", `${await firstRanked()} vs ${leader.first}`);
    await shot("cast-rank");
    const pattern = page.locator("[data-pattern]").first();
    const patternStat = await pattern.getAttribute("data-pattern");
    await pattern.click();
    await page.waitForTimeout(600);
    check((await page.locator("[data-rank]").getAttribute("data-rank")) === patternStat, "a pattern opens the Rank that shows it", patternStat);
    await page.locator('select[aria-label="Ranked by"]').selectOption("points");
    await page.locator('select[aria-label="Show"]').selectOption("all");
    await page.waitForTimeout(400);

    await page.locator("[data-compare]").click();
    await page.locator("[data-rank] [data-cast]").nth(0).click();
    await page.locator("[data-rank] [data-cast]").nth(1).click();
    await page.locator("[data-compare-sheet]").waitFor();
    await page.waitForTimeout(400);
    check((await page.locator("[data-compare-sheet] .grid").count()) === a.stats.length, "Compare two: side by side on every stat");
    await shot("cast-compare");
    await closeSheet();

    const before = (await pool.query(`SELECT count(*)::int AS n FROM chat_messages WHERE league_id = ANY($1::uuid[])`, [Object.values(fx.leagues)])).rows[0].n;
    await page.locator("[data-share]").click();
    await page.waitForTimeout(1200);
    const posted = (await pool.query(`SELECT text FROM chat_messages WHERE league_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 1`, [Object.values(fx.leagues)])).rows[0];
    const after = (await pool.query(`SELECT count(*)::int AS n FROM chat_messages WHERE league_id = ANY($1::uuid[])`, [Object.values(fx.leagues)])).rows[0].n;
    check(after === before + 1 && /stats · ranked by points · Episodes 1–5/.test(posted?.text || ""), "Share this posts the view to the couch's chat", posted && posted.text);

    // The slider: a range asks again, and By episode follows it.
    await page.locator("[data-view=heat]").click();
    await page.waitForTimeout(400);
    check((await page.locator("[data-heat] thead th").count()) === 5 + 2, "By episode: a column per episode, 1 to 5");
    await shot("cast-heat");
    statsCalls.length = 0;
    const fromThumb = page.locator('input[aria-label="From episode"]');
    await fromThumb.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200);
    check((await page.locator("[data-range]").textContent()) === "3 – 5" && statsCalls.some((u) => /from=3&to=5/.test(u)), "the slider's range asks again (from=3&to=5)", statsCalls.join(" "));
    check((await page.locator("[data-heat] thead th").count()) === 3 + 2, "By episode shows only the range's episodes");
    await fits("Cast, By episode");
    await shot("cast-heat-range");

    await page.goto(`${BASE}/show/${sid}/cast?rank=zeroVotesSafe&from=2&to=4`, { waitUntil: "networkidle" });
    await page.locator("[data-rank]").waitFor();
    check((await page.locator("[data-rank]").getAttribute("data-rank")) === "zeroVotesSafe" && (await page.locator("[data-range]").textContent()) === "2 – 4", "?rank=&from=&to= opens that view (Share's link)");

    // ---- Tonight's Stats card and the stats page ----
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    const card = page.locator("[data-stats-card]");
    await card.waitFor({ timeout: 20_000 });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    check((await card.locator("[data-preview]").count()) === 0 && (await card.getByText("Stat of the week").count()) === 1, "Tonight's Stats card is real, with a stat of the week");
    await card.screenshot({ path: path.join(out, "tonight-stats-card.png") });
    const week = await card.locator("[data-stat-week]").getAttribute("data-stat-week");
    await card.locator("[data-stat-week]").click();
    await page.locator("[data-stats-page] [data-stat-section]").first().waitFor();
    await page.waitForTimeout(500);
    check(page.url().includes("page=stats") && page.url().includes(`stat=${week}`) && (await page.locator("[data-stats-page] [data-stat-section]").first().getAttribute("data-stat-section")) === week, "the stat of the week opens the stats page sorted by it", page.url());
    const focusedRows = await page.locator(`[data-stat-section="${week}"] [data-board-row]`).count();
    check(focusedRows === a.cast.filter((c) => (c.counts[week] || 0) > 0).length, "the stat you came for lists everyone who has it", `${focusedRows}`);
    check((await page.locator("[data-stat-section]:not([data-focused]) ").first().locator("[data-board-row]").count()) <= 5, "the other stats, top five each");
    await fits("the stats page");
    await shot("stats-page");
    await page.locator("[data-rank-link]").click();
    await page.waitForURL(`**/show/${sid}/cast?rank=${week}`);
    await page.locator("[data-rank]").waitFor();
    check((await page.locator("[data-rank]").getAttribute("data-rank")) === week, "See everyone ranked by this: the Cast tab's Rank");
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator("[data-all-stats]").click();
    await page.locator("[data-stats-page] [data-stat-section]").first().waitFor();
    check((await page.locator("[data-stats-page] [data-focused]").count()) === 0 && (await page.locator("[data-stats-page] [data-stat-section]").count()) === a.stats.length - 1, "All N stats: every stat, top five each");
    await page.goBack();
    await page.waitForTimeout(500);
    check(!page.url().includes("page=stats"), "back closes the stats page");

    // ---- the hub's By the numbers ----
    await page.goto(`${BASE}/home?page=numbers`, { waitUntil: "networkidle" });
    await page.locator("[data-numbers-row]").first().waitFor({ timeout: 20_000 });
    check((await page.locator("[data-stat-deck] button").count()) >= 1 && (await page.locator('[role=dialog] [data-preview="hub.numbers"]').count()) === 1 && (await page.locator("[role=dialog] [data-preview]").count()) === 1, "By the numbers: real stat cards, only the couch accolades in Preview");
    await fits("By the numbers");
    await shot("hub-numbers");
    const row = page.locator(`[data-numbers-show="${sid}"] [data-numbers-row]`).first();
    const rowStat = await row.getAttribute("data-numbers-row");
    await row.click();
    await page.waitForURL((u) => u.searchParams.get("page") === "stats");
    await page.locator("[data-stats-page] [data-stat-section]").first().waitFor();
    check(new URL(page.url()).searchParams.get("season") === sid && (await page.locator("[data-stats-page] [data-stat-section]").first().getAttribute("data-stat-section")) === rowStat && (await page.getByRole("heading", { name: "ZT Survivor stats" }).count()) === 1, "a row opens that show's stats page over the hub, sorted by it");
    await shot("hub-stats-page");
    await page.goBack();
    await page.waitForTimeout(600);
    check(new URL(page.url()).searchParams.get("page") === "numbers", "back returns to By the numbers");

    // ---- sam's slider, riley's Traitors ----
    const sb = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(sb.close);
    await sb.page.goto(`${sb.BASE}/show/${sid}/cast`, { waitUntil: "networkidle" });
    await sb.page.locator("[data-explorer]").waitFor({ timeout: 30_000 });
    check((await sb.page.locator('input[aria-label="To episode"]').getAttribute("max")) === "3", "sam's slider stops at Episode 3");
    await shot("cast-sam", sb.page);
    const rb = await open({ user: fixture.username("riley"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(rb.close);
    await rb.page.goto(`${rb.BASE}/show/${tid}/cast`, { waitUntil: "networkidle" });
    await rb.page.locator("[data-explorer]").waitFor({ timeout: 30_000 });
    const groups = await rb.page.locator("[data-group]").evaluateAll((els) => els.map((e) => e.dataset.group));
    const options = await rb.page.locator('select[aria-label="Show"] option').allTextContents();
    check(groups.join() === "Still in,Out" && options.join() === "Everyone,Still in,Out", "Traitors: Still in / Out, and no faction to filter by", `${groups} | ${options}`);
    check(/Out · Ep 2 · Traitor/.test((await rb.page.locator('[data-cast="Ivo"]').textContent()) || "") && !/Traitor|Faithful/.test((await rb.page.locator('[data-group="Still in"]').textContent()) || ""), "the banished Traitor says so; nobody still in does");
    await rb.page.locator('[data-cast="Hana"]').click();
    await rb.page.locator("[data-story]").waitFor();
    check(/stays secret until they leave/.test((await rb.page.locator("[data-role]").textContent()) || ""), "a story keeps someone's role secret while they're in");
    await fits("Traitors Cast", rb.page);
    await shot("cast-traitors-story", rb.page);

    const real = [...errors, ...sb.errors, ...rb.errors].filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
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
