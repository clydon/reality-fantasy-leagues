// Dev-only check of the engine lab (docs/PLAN-start-a-game-gpt.md step A5: /desk/lab, src/lib/server/engine-lab.ts,
// /api/desk/lab) and the capability tracker it reads (tests/fixtures/engine-capabilities.json), against the dev server, on
// new-fixture.js's couch (ZT Survivor 51). Added here: the desk's own admin (zt_nd_desk, site role admin, as
// check-phase-starts.js makes one), on the fixture's couch so a test game can go there.
//   - The API: the seasons that are games (ZT Survivor 51 among them), the couches a test game can go on (the zt- couch, not
//     the admin's others), every tracker row; refused for someone who isn't a site admin (403).
//   - Check on ZT Survivor 51: a dial's ✅ spec plays now (a game of questions, in the engine's words, How it works, the row's
//     status there ✅); a question the show's research doesn't answer is refused (the data rule); a sport's stats wait for L3;
//     what isn't JSON is a 400. A6's: the tribe winner and who goes home, and who finds an idol, play there; a Traitors
//     question is refused (no secret roles on this show), and so is each couple's judges' score (Dancing with the Stars').
//     A7's: a question every two episodes, a late lock (in its details), which episode the merge happens in.
//   - Start it as a test game: on the zt- couch, through the game's writer (a game of questions asking just that, the admin its
//     Commissioner, its spec carried, the game-specs flag's check passing); refused on a couch that isn't a test couch or a
//     zt- fixture's (403), and for a spec that doesn't play (409). Which tribe wins immunity starts too, its faces the tribes;
//     and a question once a phase, the season's phases recorded in it (A7).
//   - In a real browser at --width (390 by default), as the admin: the lab, a season picked, a tracker row filtered and picked
//     (its spec fills the box), Check (plays now, the sentence), the couch picked, Start (the link to its Games tab); a refused
//     spec shows what's wrong. Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-engine-lab.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const C = require("../../src/lib/game/game-spec/capabilities.js");
const G = require("../../src/lib/game/game-spec/index.js");
const { checkLeague } = require("../game-specs-flag.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-engine-lab runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-engine-lab.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const DESK = "zt_nd_desk";

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
    const couch = fx.couchId;
    const sid = fx.seasonId;
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [deskId]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    const desk = await api({ user: DESK, pass: PASSWORD });
    const jordan = await api({ user: "zt_nd_jordan", pass: PASSWORD });
    const tracker = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "tests", "fixtures", "engine-capabilities.json"), "utf8"));
    const rowSpec = (id) => C.rowsOf(tracker).find((r) => r.id === id)?.spec;

    // ---------- the API ----------
    let r = await desk.call("GET", "/api/desk/lab");
    const o = r.body;
    check(r.status === 200 && o.seasons?.some((s) => s.seasonId === sid) && o.rows?.length === C.rowsOf(tracker).length, "the lab's options: the seasons that are games (ZT Survivor 51 among them), every tracker row", `${r.status} ${o.rows?.length}`);
    check(o.couches?.length === 1 && o.couches[0].couchId === couch && o.couches[0].kind === "fixture", "  the couches a test game can go on: the zt- fixture's", JSON.stringify(o.couches));
    r = await jordan.call("GET", "/api/desk/lab");
    check(r.status === 403, "refused for someone who isn't a site admin (403)", `${r.status}`);

    const labCheck = (body) => desk.call("POST", "/api/desk/lab", { action: "check", seasonId: sid, ...body });
    r = await labCheck({ spec: JSON.stringify(rowSpec("when.each")), row: "when.each" });
    check(r.status === 200 && !r.body.problems.length && !r.body.waits.length && r.body.playsAs === "questions" && r.body.startable, "a dial's ✅ spec plays now on ZT Survivor 51: a game of questions", JSON.stringify(r.body).slice(0, 300));
    check(/everyone answers one question before each episode: who goes home/.test(r.body.describe?.sentence ?? "") && r.body.describe.rules.length > 0 && r.body.row?.state === "yes", "  in the engine's words, How it works, and the row ✅ there", JSON.stringify({ s: r.body.describe?.sentence, row: r.body.row }));
    const sheet = { get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" } };
    r = await labCheck({ spec: { ...sheet, ask: [{ id: "rain", ask: "Will it rain?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "itRained", take: "happened" } }] } });
    check(r.status === 200 && r.body.problems.some((p) => p.at.startsWith("ask")) && !r.body.startable, "a question the show's research doesn't answer is refused (the data rule)", JSON.stringify(r.body.problems));
    r = await labCheck({ spec: { preset: "weekly-lineup", score: { by: "stats", points: { HR: 5 } } } });
    check(r.status === 200 && (r.body.waits.some((w) => w.step === "sports") || r.body.problems.length > 0) && !r.body.startable, "a sport's stats don't play here yet", JSON.stringify([r.body.problems, r.body.waits]).slice(0, 300));
    r = await labCheck({ spec: "{ not json" });
    check(r.status === 400, "what isn't JSON is a 400", `${r.status}`);
    // A6: who a moment happened to, which tribe, a secret role, each couple's score, on this season's own rules.
    r = await labCheck({ spec: JSON.stringify(rowSpec("p3")), row: "p3" });
    check(r.status === 200 && r.body.startable && r.body.row?.state === "yes" && /which tribe wins immunity and who goes home/.test(r.body.describe?.sentence ?? ""), "A6: the tribe winner and who goes home each week plays on ZT Survivor 51", JSON.stringify({ s: r.body.describe?.sentence, p: r.body.problems }));
    r = await labCheck({ spec: JSON.stringify(rowSpec("what.who")), row: "what.who" });
    check(r.status === 200 && r.body.startable && /who finds an idol/.test(r.body.describe?.sentence ?? ""), "  who finds an idol plays there too", JSON.stringify(r.body.problems));
    r = await labCheck({ spec: JSON.stringify(rowSpec("w102")), row: "w102" });
    check(r.status === 200 && !r.body.startable && r.body.problems.some((p) => p.at === "ask[0].settle.role") && r.body.row?.state !== "yes", "  a Traitors question (who are the Traitors) is refused: this show has no secret roles", JSON.stringify(r.body.problems));
    r = await labCheck({ spec: JSON.stringify(rowSpec("what.each")), row: "what.each" });
    check(r.status === 200 && !r.body.startable && r.body.problems.some((p) => p.at === "ask[0].settle.moment"), "  each couple's judges' score is Dancing with the Stars': no such moment here", JSON.stringify(r.body.problems));
    // A7: windows, which episode the merge is, and a late lock.
    r = await labCheck({ spec: JSON.stringify(rowSpec("when.everyN")), row: "when.everyN" });
    check(r.status === 200 && r.body.startable && r.body.row?.state === "yes" && /every two episodes/.test(r.body.describe?.sentence ?? ""), "A7: a question every two episodes plays on ZT Survivor 51", JSON.stringify({ s: r.body.describe?.sentence, p: r.body.problems }));
    r = await labCheck({ spec: JSON.stringify(rowSpec("when.ownLock")), row: "when.ownLock" });
    check(r.status === 200 && r.body.startable && r.body.describe?.details?.some((d) => d.id === "lateLock" && /24 hours/.test(d.value)), "  a late lock plays, said in its details", JSON.stringify(r.body.describe?.details));
    r = await labCheck({ spec: JSON.stringify(rowSpec("what.whichEpisode")), row: "what.whichEpisode" });
    check(r.status === 200 && r.body.startable, "  which episode the merge happens in plays", JSON.stringify(r.body.problems));

    // ---------- start it as a test game ----------
    const labStart = (body) => desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, ...body });
    r = await labStart({ spec: { preset: "weekly-lineup", score: { by: "stats", points: { HR: 5 } } } });
    check(r.status === 409 || r.status === 400, "a spec that doesn't play can't be started", `${r.status} ${JSON.stringify(r.body)}`);
    r = await labStart({ couchId: crypto.randomUUID(), spec: rowSpec("when.each") });
    check(r.status === 403, "  nor on a couch that isn't a test couch or a zt- fixture's (403)", `${r.status}`);
    r = await labStart({ spec: rowSpec("when.each") });
    const made = r.body.leagueId ? (await pool.query("SELECT * FROM leagues WHERE id = $1", [r.body.leagueId])).rows[0] : null;
    const role = made ? (await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [made.id, deskId])).rows[0]?.role : null;
    check(
      r.status === 200 && !!made && made.couch_id === couch && made.state.settings.leagueTypeId === "questions" && S.AnswerLogic.questions(made.state).map((q) => q.id).join() === "out" && role === "commissioner",
      "started as a test game on the zt- couch: a game of questions asking who goes home, the admin its Commissioner",
      JSON.stringify(r.body)
    );
    check(!!made && checkLeague(made.state).ok && made.name.startsWith("Lab · "), "  its spec carried and in step (the flag's check); its name says it's the lab's", made?.name);
    check(!!made && S.startEpisode(made.state) === 6, "  with no span in the spec it starts with the next episode to air (6), as Start a game's do", String(made && S.startEpisode(made.state)));
    check(!!made && (await pool.query("SELECT 1 FROM league_changes WHERE league_id = $1 AND text LIKE '%from the engine lab'", [made.id])).rowCount === 1, "  a line in its Recent changes says the lab started it");
    r = await labStart({ spec: rowSpec("what.group") });
    const tribal = r.body.leagueId ? (await pool.query("SELECT * FROM leagues WHERE id = $1", [r.body.leagueId])).rows[0] : null;
    const tribeQ = tribal && S.AnswerLogic.questions(tribal.state)[0];
    check(r.status === 200 && tribeQ?.answer === "group" && tribeQ.settle.take === "who" && checkLeague(tribal.state).ok, "A6: which tribe wins immunity starts as a test game too (a group answer)", JSON.stringify(r.body));
    // Who's on which tribe waits until you've seen the episode before (5): the admin has, here.
    await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 5) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = 5", [deskId, sid]);
    const tribeRead = r.body.leagueId ? (await desk.call("GET", `/api/seasons/${sid}/answers?league=${r.body.leagueId}`)).body : null;
    check((tribeRead?.questions?.[0]?.faces ?? []).length === 3, "  its question names the three tribes, once the admin has seen Episode 5", JSON.stringify(tribeRead?.questions?.[0]).slice(0, 300));
    r = await labStart({ spec: rowSpec("when.perPhase") });
    const phased = r.body.leagueId ? (await pool.query("SELECT state FROM leagues WHERE id = $1", [r.body.leagueId])).rows[0]?.state : null;
    check(r.status === 200 && !!phased && G.sameValue(phased.phaseStarts, { tribes: 1 }) && G.sameValue(phased.phaseWindows, {}), "A7: a question once a phase starts as a test game, the season's phases recorded (the merge not known yet)", JSON.stringify(phased && { starts: phased.phaseStarts, windows: phased.phaseWindows }));

    // ---------- in the browser ----------
    if (!apiOnly) {
      let n = 0;
      const shot = async (page, name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true });
      const fits = async (page, what) => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 0, `  ${what}: nothing wider than the screen at ${width}`, `${over}px over`);
      };
      const b = await open({ user: DESK, pass: PASSWORD, width, height: 844 });
      closers.push(b.close);
      const page = b.page;
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${BASE}/desk/lab`, { waitUntil: "load" });
      await page.locator("[data-lab-season] option").nth(1).waitFor({ state: "attached", timeout: 30000 });
      await page.locator("[data-lab-season]").selectOption(sid);
      await page.locator("[data-lab-filter]").fill("when.each");
      await page.locator("[data-lab-row]").selectOption("when.each");
      const box = await page.locator("[data-lab-spec]").inputValue();
      check(/"answers"/.test(box) && (await page.locator("[data-lab-picked='when.each']").isVisible()), "the lab: a tracker row filtered and picked, its spec in the box");
      await page.locator("[data-lab-check]").click();
      const verdict = page.locator("[data-lab-verdict]");
      await verdict.waitFor({ timeout: 20000 });
      check((await verdict.getAttribute("data-lab-verdict")) === "plays" && /who goes home/.test((await page.locator("[data-lab-sentence]").textContent()) ?? ""), "  Check: plays now, the game in the engine's words");
      await page.locator("[data-lab-couch]").selectOption(couch);
      await fits(page, "the lab");
      await shot(page, "lab-plays");
      await page.locator("[data-lab-start]").click();
      await page.locator("[data-lab-started]").waitFor({ timeout: 30000 });
      check(/Started Lab/.test((await page.locator("[data-lab-started]").textContent()) ?? ""), "  Start it as a test game: started, with a link to its Games tab");
      // A row with no spec empties the box: its status is never read with another row's spec.
      await page.locator("[data-lab-filter]").fill("");
      await page.locator("[data-lab-row]").selectOption("when.live");
      check((await page.locator("[data-lab-spec]").inputValue()) === "" && /⏳ A15/.test((await page.locator("[data-lab-picked='when.live']").textContent()) ?? ""), "  a row with no spec (live, mid-episode, ⏳ A15) empties the box");
      await page.locator("[data-lab-row]").selectOption("");
      await page.locator("[data-lab-spec]").fill(JSON.stringify({ ...sheet, ask: [{ id: "rain", ask: "Will it rain?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "itRained", take: "happened" } }] }, null, 2));
      await page.locator("[data-lab-check]").click();
      await page.locator("[data-lab-verdict='problems']").waitFor({ timeout: 20000 });
      check(/couch's word|research|settle/i.test((await page.locator("[data-lab-list='problems']").textContent()) ?? ""), "  a refused spec says what's wrong", (await page.locator("[data-lab-list='problems']").textContent()) ?? "");
      await shot(page, "lab-refused");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
