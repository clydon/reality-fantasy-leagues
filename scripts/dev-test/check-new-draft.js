// Dev-only check for the draft room and the blind draft (docs/PLAN-new-design.md step 7), against the dev server, on
// draft-fixture.js (a couch about to draft: Outlast's turn-based draft in the mock's order riley, alex, jordan, sam, and
// Weekly Lineup's blind draft, 4 each), then on new-fixture.js for Backstage › Waivers' Pick for them:
//   1. Before the start: both drafts and their roles, the cast by tribe, an unchanged draft answering only its version,
//      Backstage's "Schedule the … draft" jobs (a Commissioner's, not a Game admin's), who may start it, a start time
//      with Undo, a time that's passed refused, a new order before the first pick, your queue (nobody else's).
//   2. As alex in a browser at --width: the order and Start, a star that queues someone, Draft settings, Start, then
//      Pick for riley (the for-bar, the bar's "For riley", the toast's Undo, the line in Recent changes), riley picking for
//      himself, alex up four seconds later (the room polls), Tonight's "Your turn to draft" into the room, the queue
//      (taken by riley, Draft from it), and the ⋯ menu's Draft room and Blind draft rows.
//   3. The rules: not your turn, someone already has them, a stale pick, classic's /draft/pick still drafting.
//   4. The pick timer: 60 seconds and "pick from their queue" (nothing before it runs out, their first still free after,
//      a line nobody made; an empty queue waits), riley's Nudge (once a turn) and Pick for sam, Undo last pick.
//   5. Played out: "Couch Cup is set", how many picks were made for someone else, no draft move left.
//   6. The blind draft: Start, locks through the API (your own picks back to you, nobody else's, a withdraw), refusals (a
//      player locking for someone, the wrong count), alex locking in the browser, Pick for sam, the reveal (nothing left
//      in blind_draft_picks, every team in the league, a line naming nobody's picks).
//   7. Pick for them in Backstage › Waivers (new-fixture.js): someone's week without their picks, a spot sent for them,
//      the line in Recent changes, a player refused; in the browser, the sheet.
// Every real league is as it was; nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-draft.js <outDir> [--width=390] [--keep]
//
// Brings draft-fixture.js and new-fixture.js up and takes them down (--keep leaves the draft fixture); touches zt-dr and
// zt-nd rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./draft-fixture");
const newFixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-draft runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-draft.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const realBefore = (await pool.query(REAL_LEAGUES)).rows;
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const q = `?couch=${fx.couchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-dr-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of fixture.PEOPLE) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const draft = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/draft${q}`)).body;
    const game = async (who, key) => (await draft(who)).games.find((g) => g.leagueId === L[key]);
    const act = (who, key, body) => as[who].call("POST", `/api/seasons/${sid}/draft`, { leagueId: L[key], ...body });
    const state = async (key) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]])).rows[0].state;
    const changes = async (key) => (await pool.query("SELECT text, undo, undone_at, user_id, batch FROM league_changes WHERE league_id = $1 ORDER BY created_at", [L[key]])).rows;
    const needs = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/backstage${q}`)).body.needs ?? [];
    const st0 = await state("outlast");
    const cid = (name, st = st0) => st.castaways.find((c) => c.name.startsWith(name)).id;
    const seat = (st, who) => st.players.find((p) => p.name === who).id;
    const until = async (fn, ms = 12000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await fn()) return true;
        await sleep(300);
      }
      return false;
    };

    // ---- 1. before the start ----
    const a0 = await draft("alex");
    const cup0 = a0.games.find((g) => g.leagueId === L.outlast);
    const lu0 = a0.games.find((g) => g.leagueId === L.lineup);
    check(a0.games.length === 2 && cup0?.kind === "snake" && lu0?.kind === "blind", "two drafts: Outlast's in turn, Weekly Lineup's blind", a0.games.map((g) => g.kind).join());
    check(cup0.phase === "waiting" && cup0.seats.map((s) => s.name).join() === "riley,alex,jordan,sam" && cup0.size === 4 && cup0.turns.length === 16, "Outlast waits to start: the mock's order, 4 each, 16 picks");
    check(cup0.cast.length === 18 && cup0.cast.every((c) => c.points === null) && cup0.cast[0].tribe?.name === "Toka", "the cast by tribe, no points before the season");
    const rileyCup = await game("riley", "outlast");
    const rileyLu = await game("riley", "lineup");
    check(cup0.commissioner && cup0.runs && rileyCup.runs && !rileyCup.commissioner && !rileyLu.runs && !(await game("jordan", "outlast")).runs, "alex runs both (Commissioner), riley Outlast (Game admin), jordan neither");
    const same = await as.alex.call("GET", `/api/seasons/${sid}/draft${q}&v=${a0.v}`);
    check(same.body.unchanged === true && same.body.v === a0.v, "an unchanged draft answers only its version");
    check((await as.alex.call("GET", `/api/seasons/${sid}/draft?couch=${fx.couchId}&v=stale`)).body.games?.length === 2, "a stale version gets the whole draft");
    const jobs = (await needs("alex")).filter((n) => n.id === "draft");
    check(jobs.map((n) => n.title).sort().join("|") === "Schedule the Outlast draft|Schedule the Weekly Lineup draft", "Backstage: schedule both drafts", jobs.map((n) => n.title).join("|"));
    check(!(await needs("riley")).some((n) => n.id === "draft"), "a Game admin isn't asked (the draft's settings are a Commissioner's)");
    check((await act("jordan", "outlast", { action: "start" })).status === 403 && (await act("riley", "outlast", { action: "start" })).status === 403, "a player can't start the draft, nor can a Game admin");
    check((await act("jordan", "outlast", { action: "pick", castawayId: cid("Brady"), n: 1 })).status === 400, "no picks before the start");
    const when = new Date(Date.now() + 3 * 86400e3).toISOString();
    const set = await act("alex", "outlast", { action: "settings", scheduledAt: when });
    check(set.status === 200 && !!set.body.batch && (await state("outlast")).settings.draftScheduledAt === when, "a start time, with its line in Recent changes", JSON.stringify(set.body));
    check(!(await needs("alex")).some((n) => n.leagueId === L.outlast), "scheduled: Outlast's job has gone");
    const undoTime = await as.alex.call("POST", `/api/seasons/${sid}/changes/${set.body.batch}/undo${q}`);
    check(undoTime.status === 200 && (await state("outlast")).settings.draftScheduledAt == null, "Undo takes the time back off");
    check((await act("alex", "outlast", { action: "settings", scheduledAt: "2020-01-01T00:00:00Z" })).status === 400, "a time that's passed is refused");
    const reversed = [...cup0.seats].reverse().map((s) => s.playerId);
    check((await act("alex", "outlast", { action: "order", order: reversed })).status === 200 && (await state("outlast")).draftOrder.join() === reversed.join(), "a new order before the first pick");
    check((await act("alex", "outlast", { action: "order", order: reversed.slice(1) })).status === 400, "an order that isn't everyone is refused");
    await act("alex", "outlast", { action: "order", order: cup0.seats.map((s) => s.playerId) });
    const queued = await act("alex", "outlast", { action: "queue", castawayIds: [cid("Brady"), cid("Maggie")] });
    check(queued.status === 200 && (await game("alex", "outlast")).queue.join() === [cid("Brady"), cid("Maggie")].join(), "alex's queue: Brady, Maggie");
    check((await game("riley", "outlast")).queue.length === 0 && !JSON.stringify(await state("outlast")).includes("queue\":"), "nobody else reads it, and it isn't in the league");

    // ---- 2. the browser, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    const shot = async (p, name) => {
      await p.evaluate(() => document.querySelector("nextjs-portal")?.remove());
      await Promise.race([settle(p), p.waitForTimeout(3000)]);
      await p.screenshot({ path: path.join(out, `${name}.png`) });
    };
    const fits = async (p, what) => check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${what}: nothing wider than the screen`);
    const toast = (p, text) => p.getByRole("status").filter({ hasText: text }).waitFor({ timeout: 8000 }).then(() => true, () => false);

    await page.goto(`${BASE}/show/${sid}/draft?game=${L.outlast}`, { waitUntil: "networkidle" });
    await page.locator("[data-draft-start]").waitFor();
    check((await page.locator("[data-seat]").count()) === 4 && /riley/i.test(await page.locator("[data-seat]").first().innerText()), "before the start: the order, riley first");
    check(await page.locator("[data-pick-time]").isVisible(), "Pick a time beside Start");
    await shot(page, "01-before-the-start");
    await fits(page, "before the start");
    await page.locator(`[data-star="${cid("Aaliyah")}"]`).click();
    check(await until(async () => (await game("alex", "outlast")).queue.includes(cid("Aaliyah"))), "a star queues Aaliyah (saved)");
    await page.locator("[data-pick-time]").click();
    const sheet = page.locator("[role=dialog][data-open]");
    await sheet.locator("[data-draft-sheet]").waitFor();
    check((await sheet.locator("[data-timer]").count()) === 3 && (await sheet.locator("input[type=datetime-local]").count()) === 1, "Draft settings: the start time and the pick timer (Off, 2 min, 60 sec)");
    await shot(page, "02-draft-settings");
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
    await page.locator("[data-draft-start]").click();
    await page.locator("[data-ticker]").waitFor();
    check(/riley picks first/i.test(await page.locator("[data-ticker]").innerText()), "started: the ticker says riley picks first");
    check(/riley is picking/i.test(await page.locator("[data-clock]").innerText()), "the clock: riley is picking, no rush");
    check((await changes("outlast")).some((c) => c.text === "Started the draft"), "Start is a line in Recent changes");

    await page.locator("[data-pick-for]").click();
    await page.locator("[data-for-bar]").waitFor();
    await page.locator(`[data-tile="${cid("Jelly")}"]`).click();
    check(/For riley · round 1/.test(await page.locator("[data-confirm]").innerText()), "picking for riley: the bar says For riley · round 1");
    await shot(page, "03-pick-for-riley");
    await page.locator("[data-draft-go]").click();
    check(await toast(page, "Jelly drafted for riley"), "the toast: Jelly drafted for riley");
    let s = await state("outlast");
    check(s.draftPicksMade === 1 && s.draftLog?.[0]?.castawayId === cid("Jelly") && s.draftLog[0].by === fx.users.alex, "riley has Jelly; the log says alex made the pick");
    const forLine = (await changes("outlast")).find((c) => c.text === "Drafted Jelly for riley");
    check(forLine?.undo?.type === "draftPick", "a line in Recent changes, with Undo", JSON.stringify(forLine));
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    check(await until(async () => (await state("outlast")).draftPicksMade === 0), "the toast's Undo takes the pick back: riley's on the clock again");
    check((await changes("outlast")).find((c) => c.text === "Drafted Jelly for riley")?.undone_at != null, "and the line is marked undone");
    check((await act("riley", "outlast", { action: "pick", castawayId: cid("Brady"), n: 1 })).body.batch === null, "riley picks Brady himself (no line: it's his own)");
    check(await page.locator('[data-clock="you"]').waitFor({ timeout: 12000 }).then(() => true, () => false), "alex is up a moment later (the room polls)");
    check(/Your queue\s*2/i.test(await page.locator('[data-seg="queue"]').innerText()), "the queue counts who's still free (Brady's gone)");
    await shot(page, "04-you-are-up");
    const moves = (await as.alex.call("GET", "/api/me/home")).body.moves ?? [];
    check(moves.some((m) => m.kind === "draftTurn" && m.leagueId === L.outlast), "alex's moves: your turn to draft");
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    const card = page.locator(`[data-move="draftTurn-${L.outlast}"]`);
    check(await card.waitFor({ timeout: 8000 }).then(() => true, () => false), "Tonight: Your turn to draft");
    await card.getByRole("link").click();
    await page.waitForURL(/\/draft\?game=/);
    check(page.url().includes(`/draft?game=${L.outlast}`), "its Draft goes to the room");
    await page.locator('[data-seg="queue"]').click();
    check(/Taken by riley/.test(await page.locator(`[data-queue-row="${cid("Brady")}"]`).innerText()), "the queue: Brady, taken by riley");
    await page.locator(`[data-queue-row="${cid("Maggie")}"] button`).click();
    await page.locator("[data-draft-go]").click();
    check(await toast(page, "You drafted Maggie"), "Draft from the queue: You drafted Maggie");
    s = await state("outlast");
    check(s.draftPicksMade === 2 && !s.draftLog[1].by, "alex's own pick: no 'by'");

    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await page.locator('button[aria-label^="Show menu"]').click();
    // The drafts are rarely wanted once they're done, so they're under Everything else (a live draft is the dock's Draft button).
    await page.locator("[data-menu-main]").getByRole("button", { name: /^Everything else/ }).click();
    const menu = page.locator("[data-menu-else]");
    check(await menu.getByText("Draft room").waitFor({ timeout: 8000 }).then(() => true, () => false), "the ⋯ menu's Everything else: Draft room");
    check(/jordan is picking/i.test(await menu.innerText()) && /Blind draft/.test(await menu.innerText()) && /not started yet/.test(await menu.innerText()), "with where each draft stands (jordan's picking; the blind draft hasn't started)");
    await shot(page, "05-show-menu");
    await page.keyboard.press("Escape");

    // ---- 3. the rules ----
    check((await act("sam", "outlast", { action: "pick", castawayId: cid("Danny"), n: 3 })).status === 403, "not your turn: refused");
    check((await act("jordan", "outlast", { action: "pick", castawayId: cid("Brady"), n: 3 })).status === 409, "someone already has them: refused");
    check((await act("jordan", "outlast", { action: "pick", castawayId: cid("Danny"), n: 2 })).status === 409, "a pick meant for an earlier turn: refused");
    const classic = await as.jordan.call("POST", `/api/leagues/${L.outlast}/draft/pick`, { castawayId: cid("Danny") });
    check(classic.status === 200 && classic.body.draftPicksMade === 3, "classic's /draft/pick still drafts, by the same rules");

    // ---- 4. the pick timer ----
    await act("alex", "outlast", { action: "settings", timer: 60 });
    await act("alex", "outlast", { action: "settings", away: "queue" });
    let g = await game("sam", "outlast");
    check(g.timer === 60 && g.away === "queue" && !!g.clock?.endsAt && g.clock.playerId === seat(s, "sam"), "a 60-second timer that picks from their queue; sam's on the clock");
    await act("sam", "outlast", { action: "queue", castawayIds: [cid("Lewis")] });
    check((await act("riley", "outlast", { action: "expire", n: 4 })).body.picked === false, "before it runs out, nothing happens");
    const back = (key) => pool.query(`UPDATE leagues SET state = jsonb_set(state, '{draftTurnAt}', to_jsonb($2::text)) WHERE id = $1`, [L[key], new Date(Date.now() - 120000).toISOString()]);
    await back("outlast");
    const ex = await act("riley", "outlast", { action: "expire", n: 4 });
    s = await state("outlast");
    const auto = s.draftLog.find((e) => e.n === 4);
    check(ex.body.picked === true && auto?.castawayId === cid("Lewis") && auto.auto && auto.playerId === seat(s, "sam"), "time's up: Lewis, sam's first still free, drafted for him", JSON.stringify(ex.body));
    const autoLine = (await changes("outlast")).find((c) => /from their queue/.test(c.text));
    check(autoLine?.text === "Drafted Lewis for sam from their queue: the timer ran out" && autoLine.user_id === null && autoLine.undo?.type === "draftPick", "a line nobody made, with Undo");
    await back("outlast");
    check((await act("riley", "outlast", { action: "expire", n: 5 })).body.picked === false && (await state("outlast")).draftPicksMade === 4, "sam's next turn, nothing left in his queue: the draft waits");

    const rb = await open({ user: fixture.username("riley"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(rb.close);
    const rp = rb.page;
    await rp.goto(`${BASE}/show/${sid}/draft?game=${L.outlast}`, { waitUntil: "networkidle" });
    await rp.locator('[data-clock="away"]').waitFor();
    check(/sam hasn't picked yet/i.test(await rp.locator("[data-clock]").innerText()) && /Time's up/.test(await rp.locator("[data-clock]").innerText()), "riley (a Game admin) sees: sam hasn't picked yet, time's up");
    check(await rp.locator("[data-nudge]").isVisible(), "with Nudge and Pick for sam");
    await shot(rp, "06-riley-nudge");
    await fits(rp, "the room, for whoever runs it");
    await rp.locator("[data-nudge]").click();
    check(await toast(rp, "Nudged sam"), "Nudge: the toast");
    check((await game("riley", "outlast")).clock?.nudged === true && (await act("alex", "outlast", { action: "nudge", n: 5 })).status === 409, "once a turn (a second nudge is refused)");
    await rp.locator('[data-clock] [data-pick-for]').click();
    await rp.locator(`[data-tile="${cid("Ori")}"]`).click();
    await rp.locator("[data-draft-go]").click();
    check(await toast(rp, "Ori drafted for sam"), "riley picks Ori for sam");
    await act("alex", "outlast", { action: "settings", timer: 0 });

    await page.goto(`${BASE}/show/${sid}/draft?game=${L.outlast}`, { waitUntil: "networkidle" });
    await page.locator("[data-draft-settings]").click();
    await sheet.locator("[data-undo-last]").waitFor();
    await sheet.locator("[data-undo-last]").click();
    check(await toast(page, "Took back sam's pick (Ori)"), "Draft settings' Undo last pick: Took back sam's pick (Ori)");
    s = await state("outlast");
    check(s.draftPicksMade === 4 && !s.draftLog.some((e) => e.castawayId === cid("Ori")), "sam's on the clock again");
    check((await act("riley", "outlast", { action: "undoLast" })).status === 403, "Undo last pick is a Commissioner's");

    // ---- 5. played out ----
    for (let i = 0; i < 20; i++) {
      const cur = await game("alex", "outlast");
      if (cur.phase !== "live") break;
      const who = cur.seats.find((x) => x.playerId === cur.clock.playerId).name;
      const free = cur.cast.find((c) => !cur.owners[c.id]);
      await act(who, "outlast", { action: "pick", castawayId: free.id, n: cur.clock.n });
    }
    g = await game("alex", "outlast");
    check(g.phase === "done" && g.teams.every((t) => t.castawayIds.length === 4) && g.madeFor === 1, "played out: four each, one pick made for someone (riley's for sam was taken back)", `${g.phase} ${g.madeFor}`);
    check(!((await as.alex.call("GET", "/api/me/home")).body.moves ?? []).some((m) => m.kind === "draftTurn"), "no draft move left");
    // "load", not "networkidle": a signed-in page's catalog read (step 10 part 1) can leave a request pending here (Noticed).
    await page.goto(`${BASE}/show/${sid}/draft?game=${L.outlast}`, { waitUntil: "load" });
    await page.locator("[data-draft-done]").waitFor();
    const done = await page.locator("[data-draft-done]").innerText();
    check(/Couch Cup\s*is set/i.test(done) && /16 picks · 1 made for someone else/.test(done), "Draft complete: Couch Cup is set, 16 picks · 1 made for someone else", done.slice(0, 120));
    await shot(page, "07-draft-done");
    await fits(page, "the finished draft");

    // ---- 6. the blind draft ----
    await page.goto(`${BASE}/show/${sid}/blind?game=${L.lineup}`, { waitUntil: "networkidle" });
    await page.locator("[data-draft-start]").click();
    await page.locator("[data-my-team]").waitFor();
    const lu = await state("lineup");
    const lid = (name) => cid(name, lu);
    check((await act("riley", "lineup", { action: "lock", playerId: seat(lu, "riley"), castawayIds: ["Carter", "Kristin", "Danny", "Eric"].map(lid) })).status === 200, "riley locks in");
    check((await game("riley", "lineup")).mine?.length === 4 && (await game("jordan", "lineup")).mine === null, "riley gets his own picks back; jordan sees none");
    check((await act("jordan", "lineup", { action: "lock", playerId: seat(lu, "jordan"), castawayIds: ["Brady", "Kristin", "Lewis", "Maggie"].map(lid) })).status === 200, "jordan locks in");
    const rileyView = await game("riley", "lineup");
    check(rileyView.teams.length === 0 && rileyView.locked.length === 2 && !JSON.stringify(rileyView.mine).includes(lid("Brady")), "nobody's picks show before the reveal: only who's in");
    check((await act("riley", "lineup", { action: "unlock", playerId: seat(lu, "riley") })).status === 200 && !(await game("riley", "lineup")).locked.includes(seat(lu, "riley")), "riley withdraws to change his");
    await act("riley", "lineup", { action: "lock", playerId: seat(lu, "riley"), castawayIds: ["Carter", "Kristin", "Danny", "Eric"].map(lid) });
    check((await act("sam", "lineup", { action: "lock", playerId: seat(lu, "jordan"), castawayIds: ["Brady", "Kristin", "Lewis", "Maggie"].map(lid) })).status === 403, "a player can't lock in for someone");
    check((await act("sam", "lineup", { action: "lock", playerId: seat(lu, "sam"), castawayIds: [lid("Brady")] })).status === 400, "the wrong number of picks is refused");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-my-team]").waitFor();
    for (const n of ["Aaliyah", "Jelly", "Carter", "Ori"]) await page.locator(`[data-tile="${lid(n)}"]`).click();
    await shot(page, "08-blind-picking");
    await page.locator("[data-lock]").click();
    check(await toast(page, "Locked in"), "alex locks in");
    check(await page.locator("[data-unlock]").waitFor({ timeout: 8000 }).then(() => true, () => false) && /Waiting for sam/i.test(await page.locator("[data-confirm]").innerText()), "locked in: waiting for sam, with Change");
    await page.locator('[data-pick-for]').click();
    await page.locator("[data-for-bar]").waitFor();
    check((await page.locator("[data-slot]").count()) === 0, "picking for sam starts empty (nothing of theirs is read)");
    for (const n of ["Eric", "Maggie", "Ori", "Sharonda"]) await page.locator(`[data-tile="${lid(n)}"]`).click();
    await page.locator("[data-lock]").click();
    check(await page.locator("[data-blind-reveal]").waitFor({ timeout: 12000 }).then(() => true, () => false), "Lock in for sam: everyone's in, the teams turn over");
    await shot(page, "09-blind-reveal");
    await fits(page, "the reveal");
    const after = await state("lineup");
    const left = (await pool.query("SELECT count(*)::int AS n FROM blind_draft_picks WHERE league_id = $1", [L.lineup])).rows[0].n;
    check(left === 0 && !!after.blindDraft.revealedAt && after.players.every((p) => after.castaways.filter((c) => c.ownerIds.includes(p.id)).length === 4), "revealed: nothing left in blind_draft_picks, every team in the league");
    const lockLine = (await changes("lineup")).find((c) => /Locked in/.test(c.text));
    check(lockLine?.text === "Locked in sam's draft picks", "a line naming nobody's picks: Locked in sam's draft picks", lockLine?.text);
    const jordanView = await game("jordan", "lineup");
    check(jordanView.phase === "done" && jordanView.teams.length === 4, "jordan sees the teams");

    // ---- 7. Pick for them, in Backstage › Waivers (new-fixture.js) ----
    const nf = await newFixture.up(pool);
    closers.push(() => newFixture.down(pool));
    const nq = `?couch=${nf.couchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[nf.users.alex]]);
    const nd = {};
    for (const who of ["alex", "sam"]) nd[who] = await api({ user: newFixture.username(who), pass: newFixture.PASSWORD });
    const bsw = (who, body) => nd[who].call("POST", `/api/seasons/${nf.seasonId}/backstage/waivers${nq}`, { leagueId: nf.leagues.outlast, ...body });
    const win = await bsw("alex", { action: "window", swaps: 1 });
    check(win.status === 200, "a waiver window with a swap each (to have something to pick for)", JSON.stringify(win.body));
    const ns = (await pool.query("SELECT state FROM leagues WHERE id = $1", [nf.leagues.outlast])).rows[0].state;
    const jordanSeat = ns.players.find((p) => p.name === "jordan").id;
    const samSeat = ns.players.find((p) => p.name === "sam").id;
    const view = await bsw("alex", { action: "claimView", playerId: jordanSeat });
    const wk = view.body.week;
    check(view.status === 200 && wk?.team?.length > 0 && wk.free.length > 0 && wk.spots.length === 0 && wk.swapsAllowed === 1, "jordan's week, as he'd see it, without his picks", JSON.stringify(view.body).slice(0, 160));
    const drop = wk.team.find((f) => f.out == null).id;
    const sent = await bsw("alex", { action: "claimFor", playerId: jordanSeat, dropId: drop, addIds: [wk.free[0].id] });
    const claim = (await pool.query("SELECT pairs, updated_by FROM waiver_claims WHERE league_id = $1 AND player_id = $2", [nf.leagues.outlast, jordanSeat])).rows[0];
    check(sent.status === 200 && claim?.updated_by === nf.users.alex && JSON.stringify(claim.pairs).includes(wk.free[0].id), "a spot sent for jordan: in his claim, sent by alex");
    const sentLine = (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 AND text LIKE 'Sent %'", [nf.leagues.outlast])).rows[0]?.text;
    check(sentLine === "Sent jordan's waiver pick", "a line in Recent changes naming nobody picked", sentLine);
    check((await bsw("sam", { action: "claimView", playerId: jordanSeat })).status >= 403, "a player can't");
    const cb = await open({ user: newFixture.username("alex"), pass: newFixture.PASSWORD, width, height: 844 });
    closers.push(cb.close);
    await cb.page.goto(`${BASE}/show/${nf.seasonId}/backstage/waivers`, { waitUntil: "networkidle" });
    const open_ = cb.page.locator('[data-claim-for-open="sam"]');
    check(await open_.waitFor({ timeout: 10000 }).then(() => true, () => false), "Backstage › Waivers: Pick for them beside sam (no picks yet)");
    await open_.click();
    const cs = cb.page.locator("[role=dialog][data-open] [data-claim-for]");
    await cs.locator("[data-claim-add]").first().waitFor();
    await cs.locator("[data-claim-add]").first().click();
    await shot(cb.page, "10-pick-for-them");
    await cs.locator("[data-claim-send]").click();
    check(await toast(cb.page, "Sent sam's pick"), "Send sam's pick: the toast");
    check((await pool.query("SELECT 1 FROM waiver_claims WHERE league_id = $1 AND player_id = $2", [nf.leagues.outlast, samSeat])).rows.length === 1, "sam's pick is in");

    const pageErrors = [...errors, ...rb.errors, ...cb.errors].filter((e) => !/favicon/.test(e));
    check(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 3).join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!keep) await fixture.down(pool);
    const realAfter = (await pool.query(REAL_LEAGUES)).rows;
    check(JSON.stringify(realAfter) === JSON.stringify(realBefore), "every real league is as it was");
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
