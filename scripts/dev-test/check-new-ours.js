// Dev-only check for Make it ours (docs/PLAN-new-design.md step 6b, part 3), against the dev server, on new-fixture.js:
// couch A ("ZT Survivor 51": alex runs its three games, riley is a Game admin of the lineup game, jordan plays on 5, sam
// on 3) and couch B ("ZT Extra": alex and casey) on one zt Survivor 51, results through Episode 5, its season's leagues
// NOT on rulebooks (as the real couch's aren't). Added here: the desk's own admin (zt_nd_desk, for the desk's changes).
//   1. Following: Scoring rules says so; riley (a Game admin) and jordan (a player) can't make it ours.
//   2. Make it ours (in the browser, as alex): one copy for couch A's three games, each now playing by it (couch B's
//      still on its show's rules), every table exactly as it was, a Recent changes line in each.
//   3. What counts: a moment that scored switched off (previewed: someone's points move), the games score it 0, Undo
//      from Recent changes puts it back.
//   4. A moment the couch answers ("Cried at Tribal Council", every time it happens): added in the sheet, on the episode
//      page for jordan; one answer waits, sam can't answer what he hasn't seen, two agreeing settle it (Episode 3), and
//      whoever runs the games settles it alone (alex, Episode 5, twice): the games count it, in couch A only.
//   5. The desk's changes: a show change from Episode 5 asks alex first (Add it, previewed: the copy has it from 5);
//      one from Episode 6 is only counted ("It shows once you've seen it", and can't be answered); undoing it on the
//      desk takes it off the copy; a fix reaches the copy and keeps the couch's own choices.
//   6. Change the points: Weekly Lineup's steppers, the preview, the season scored again, Undo.
//   7. Follow it again: what goes back (previewed), the copy archived, the games on their show's rules with every table
//      as it was at the start; Undo brings the copy back.
//   8. A correction that adds (the desk decides a result into Episode 5, already final): "Added" in Backstage ›
//      Results' Corrections, "Don't count it in our games" (previewed), out of couch A's games and still in couch B's,
//      the episode page says so; dropping the ruling counts it again.
//   9. Nothing real moved; the screens at --width (nothing wider than the screen, no page errors).
// Screenshots go to <outDir>.
//
//   npm run dev                                              (in another terminal)
//   node scripts/dev-test/check-new-ours.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only, never the rulebooks flag or a
// season's live switch. Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-ours runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-ours.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const DESK = fixture.username("desk");
const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const realBefore = (await pool.query(REAL_LEAGUES)).rows;
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues;
    const A = `?couch=${fx.couchId}`;
    const couchA = ["outlast", "lineup", "pool"];
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`,
      [deskId, DESK, `${DESK}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);

    const stateOf = async (k) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L[k]])).rows[0].state;
    const rulebookOf = async (k) => (await stateOf(k)).settings.rulebook ?? null;
    const as = { desk: await api({ user: DESK, pass: fixture.PASSWORD }) };
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const rules = async (who = "alex") => (await as[who].call("GET", `/api/seasons/${sid}/backstage/rules${A}`)).body;
    const post = (who, body) => as[who].call("POST", `/api/seasons/${sid}/backstage/rules${A}`, body);
    // Every table of alex's games here, as the Games tab reads them.
    const tables = async () =>
      JSON.stringify(((await as.alex.call("GET", `/api/seasons/${sid}/games${A}`)).body.games ?? []).map((g) => [g.gameName, (g.table ?? []).map((r) => [r.name, r.total])]));
    const startTables = await tables();
    const pointsIn = async (k, type) => {
      const s = await stateOf(k);
      return s.episodes.flatMap((e) => (e.scoringEvents ?? []).filter((x) => x.type === type)).reduce((t, ev) => t + S.ActiveRosterLogic.eventPoints(s, ev), 0);
    };
    const linesOf = async (k, kind) => (await pool.query("SELECT text, batch, undone_at FROM league_changes WHERE league_id = $1 AND kind = $2 ORDER BY created_at", [L[k], kind])).rows;
    const undo = async (batch) => as.alex.call("POST", `/api/seasons/${sid}/changes/${encodeURIComponent(batch)}/undo${A}`);

    // ---- browser helpers ----
    const ui = (b) => {
      const failed = [];
      b.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(b.BASE, "")}`));
      return failed;
    };
    const hideOverlay = (b) =>
      b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(st);
        });
      });
    let n = 0;
    const shot = async (page, name) => {
      await page.waitForTimeout(350);
      await Promise.race([settle(page), page.waitForTimeout(3000)]); // a skeleton's pulse never ends
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

    // ---- 1. following ----
    const r0 = await rules();
    check(r0.ours && r0.ours.copy === null && r0.ours.canChange === true, "Scoring rules: following the season's rulebook, alex can make it ours", JSON.stringify(r0.ours).slice(0, 200));
    check((await rules("riley")).ours.canChange === false, "riley (a Game admin) can't change the rules");
    check((await post("riley", { action: "ours" })).status === 403, "riley's Make it ours is refused");
    check((await as.jordan.call("GET", `/api/seasons/${sid}/backstage/rules${A}`)).status === 403, "jordan (a player) has no Scoring rules");

    // ---- 2. make it ours ----
    const a = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(a.close);
    const aFailed = ui(a);
    await hideOverlay(a);
    await a.page.goto(`${a.BASE}/show/${sid}/backstage/rules`);
    await a.page.locator("[data-rulebook][data-ours='no']").waitFor({ timeout: 20000 });
    await fits(a.page, "Scoring rules, following");
    await shot(a.page, "rules-following");
    await a.page.locator("[data-make-ours]").click();
    await a.page.locator("[data-ours-sheet]").waitFor();
    await shot(a.page, "make-it-ours");
    await a.page.locator("[data-ours-confirm]").click();
    check(/It's yours now/.test(await toasted(a.page, /It's yours now/)), "Make it ours: It's yours now");
    await a.page.locator("[data-rulebook][data-ours='yes']").waitFor({ timeout: 20000 });
    const copy = (await pool.query("SELECT id, owner_kind, status, provenance, compiled_source FROM rulebooks WHERE provenance->>'ours' = 'true' AND provenance->>'couchId' = $1", [fx.couchId])).rows;
    check(copy.length === 1 && copy[0].owner_kind === "league" && copy[0].status === "in_force" && copy[0].compiled_source === "blocks", "one copy for the couch, compiled from its blocks", JSON.stringify(copy));
    const copyId = copy[0]?.id;
    const pointed = (await pool.query("SELECT id FROM leagues WHERE rulebook_id = $1", [copyId])).rows.map((r) => r.id).sort();
    check(JSON.stringify(pointed) === JSON.stringify(couchA.map((k) => L[k]).sort()), "couch A's three games point at it, couch B's doesn't");
    const onCopy = await Promise.all(couchA.map(rulebookOf));
    check(onCopy.every((r) => r?.id === copyId), "each of the three plays by it (settings.rulebook)");
    check(!(await rulebookOf("extra")), "couch B's game is still on its show's rules");
    check((await pool.query("SELECT rulebook_live FROM show_seasons WHERE id = $1", [sid])).rows[0].rulebook_live === false && (await pool.query("SELECT value FROM app_settings WHERE key = 'rulebooks'")).rows[0]?.value !== true, "neither the season's switch nor the flag is on");
    check((await tables()) === startTables, "every table exactly as it was (an unedited copy scores the same)");
    check((await Promise.all(couchA.map((k) => linesOf(k, "rules.ours")))).every((l) => l.length === 1), "a Recent changes line in each game");
    const fresh = (await rules()).ours;
    check(fresh.moments.length > 10 && fresh.moments.every((m) => m.counts), "What counts: every moment the rulebook counts, all on (none the rulebook itself leaves out)", `${fresh.moments.length}`);
    await fits(a.page, "Scoring rules, your own");
    await shot(a.page, "rules-ours");

    // ---- 3. what counts ----
    const off = "chosenForReward";
    const before = await pointsIn("lineup", off);
    check(before > 0, "Chosen to join a reward scored in the lineup game", String(before));
    await a.page.locator("[data-what-counts]").click();
    await a.page.locator("[data-counts-sheet]").waitFor();
    await a.page.locator(`[data-counts-sheet] [data-moment='${off}']`).click();
    await fits(a.page, "What counts");
    await shot(a.page, "what-counts");
    await a.page.locator("[data-counts-done]").click();
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    check((await a.page.locator("[data-guard='2']").innerText()).includes("Weekly Lineup"), "previewed: Weekly Lineup's points move");
    await shot(a.page, "what-counts-preview");
    await a.page.locator("[data-guard-confirm]").click();
    check(/Saved what counts/.test(await toasted(a.page, /Saved what counts/)), "Saved what counts");
    const blocks1 = (await pool.query("SELECT blocks FROM rulebooks WHERE id = $1", [copyId])).rows[0].blocks;
    check(blocks1.momentNotes?.[off]?.off === true, "the copy doesn't count it (momentNotes)");
    check((await pointsIn("lineup", off)) === 0, "the lineup game scores it 0 now", String(await pointsIn("lineup", off)));
    check((await tables()) !== startTables, "and its table moved");
    const counted = (await linesOf("lineup", "rules.ours")).pop();
    check((await undo(counted.batch)).status === 200 && (await pointsIn("lineup", off)) === before, "Undo from Recent changes: it counts again");
    check((await tables()) === startTables, "every table as it was");

    // ---- 4. a moment the couch answers ----
    await a.page.reload();
    await a.page.locator("[data-add-moment]").click();
    await a.page.locator("[data-add-sheet]").waitFor();
    await a.page.locator("[data-moment-label]").fill("Cried at Tribal Council");
    await a.page.locator("[data-counted='eachTime']").click();
    await a.page.locator("[data-add-sheet] button[aria-label='More']").click();
    await fits(a.page, "Add a moment");
    await shot(a.page, "add-moment");
    await a.page.locator("[data-add-it]").click();
    check(/Added/.test(await toasted(a.page, /Added/)), "a moment added");
    const own = (await pool.query("SELECT blocks FROM rulebooks WHERE id = $1", [copyId])).rows[0].blocks;
    const mine = (own.customMoments ?? []).find((m) => m.label === "Cried at Tribal Council");
    check(mine && mine.answeredBy === "league" && mine.counted === "eachTime" && own.points[mine.id] === 2, "on the copy: the couch answers it, each time, +2", JSON.stringify(mine));
    const mid = mine?.id;
    check(S.formatOf(await stateOf("lineup")).events.some((e) => e.id === mid), "the games know it");
    await a.page.locator(`[data-own-moment='${mid}']`).waitFor({ timeout: 15000 });
    await shot(a.page, "own-moment");
    const answer = (who, ep, picks) => as[who].call("POST", `/api/seasons/${sid}/couch-moments/${ep}${A}`, { moment: mid, picks });
    const couchEvents = async (k, ep) => {
      const s = await stateOf(k);
      const name = new Map(s.castaways.map((c) => [c.id, c.name]));
      return (s.episodes.find((e) => e.number === ep)?.scoringEvents ?? []).filter((e) => e.type === mid && e.couch).map((e) => `${name.get(e.castawayId)}${e.units ? `×${e.units}` : ""}`);
    };
    check((await as.sam.call("GET", `/api/seasons/${sid}/couch-moments/5${A}`)).status === 403 && (await answer("sam", 5, [{ name: "Eric Macksoud" }])).status === 403, "sam (on 3) can't see or answer Episode 5's");
    check((await as.casey.call("GET", `/api/seasons/${sid}/couch-moments/3?couch=${fx.extraCouchId}`)).body.moments.length === 0, "couch B has no moments of its own");

    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    const jFailed = ui(j);
    await hideOverlay(j);
    const episodePage = async (ep) => {
      await j.page.goto(`${j.BASE}/show/${sid}/episodes`);
      await j.page.locator(`[data-ep='${ep}']`).first().click({ timeout: 20000 });
      await j.page.locator(`[data-episode-page='${ep}']`).waitFor({ timeout: 20000 });
    };
    await episodePage(3);
    await j.page.locator("[data-couch-moments='3']").waitFor({ timeout: 20000 });
    await j.page.locator(`[data-couch-answer='${mid}']`).click();
    await j.page.locator("[data-answer-sheet]").waitFor();
    const danny = (await j.page.locator("[data-answer-sheet] [data-pick]").allInnerTexts()).length;
    check(danny > 5, "the sheet has who was still in", String(danny));
    await j.page.locator("[data-pick='Danny Kilby']").click();
    await fits(j.page, "the couch's answer");
    await shot(j.page, "couch-answer");
    await j.page.locator("[data-answer-send]").click();
    check(/Sent/.test(await toasted(j.page, /Sent/)), "jordan's answer is in, waiting for a second");
    check((await couchEvents("lineup", 3)).length === 0, "one answer counts nowhere yet");
    await j.page.locator("[data-couch-status]").first().waitFor();
    check(/waiting for a second/.test(await j.page.locator(`[data-couch-moment='${mid}'] [data-couch-status]`).innerText()), "the card says it's waiting for a second");
    await shot(j.page, "couch-moments-waiting");
    const two = await answer("sam", 3, [{ name: "Danny Kilby" }]);
    check(two.status === 200 && two.body.moments[0].by === "agreed", "sam agrees on Episode 3: settled by two", JSON.stringify(two.body.moments?.[0]).slice(0, 200));
    check((await Promise.all(couchA.map((k) => couchEvents(k, 3)))).every((e) => JSON.stringify(e) === JSON.stringify(["Danny Kilby"])), "every game on the copy counts Danny on Episode 3");
    check((await couchEvents("extra", 3)).length === 0, "couch B's game doesn't");
    check((await linesOf("lineup", "results.couch")).length === 1, "a line in Recent changes");
    const runner = await answer("alex", 5, [{ name: "Eric Macksoud", times: 2 }]);
    check(runner.status === 200 && runner.body.moments[0].by === "runner", "alex (who runs the games) settles Episode 5 alone");
    check(JSON.stringify(await couchEvents("lineup", 5)) === JSON.stringify(["Eric Macksoud×2"]) && (await pointsIn("lineup", mid)) === 2 + 4, "Eric twice on 5 (+4), Danny once on 3 (+2)", String(await pointsIn("lineup", mid)));

    // ---- 5. the desk's changes reach the copy ----
    const seasonBook = (await pool.query("SELECT id FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [sid])).rows[0].id;
    const page0 = (await as.desk.call("GET", `/api/desk/rulebooks/${seasonBook}`)).body;
    const withTwist = (b, id, name) => ({ ...b, twists: [...b.twists, { id, type: "advantage", name, oneIsCalled: `a ${name}`, gotBy: "found", does: ["cancelsVotes"], lasts: "oneUse" }] });
    const ch5 = await as.desk.call("POST", `/api/desk/rulebooks/${seasonBook}`, { action: "save", kind: "show_changed", fromEpisode: 5, blocks: withTwist(page0.now, "blockAVote", "Block a Vote") });
    check(ch5.status === 200, "the desk: the show changed from Episode 5", JSON.stringify(ch5.body).slice(0, 200));
    const page1 = (await as.desk.call("GET", `/api/desk/rulebooks/${seasonBook}`)).body;
    const ch6 = await as.desk.call("POST", `/api/desk/rulebooks/${seasonBook}`, { action: "save", kind: "show_changed", fromEpisode: 6, blocks: withTwist(page1.now, "shotInTheDark", "Shot in the Dark") });
    check(ch6.status === 200, "and from Episode 6");
    const drafts = (await pool.query("SELECT from_episode, status FROM rulebook_edits WHERE rulebook_id = $1 AND NOT COALESCE((proposal->>'copied')::boolean, false) ORDER BY from_episode", [copyId])).rows;
    check(JSON.stringify(drafts) === JSON.stringify([{ from_episode: 5, status: "draft" }, { from_episode: 6, status: "draft" }]), "both reach the copy as questions, nothing in force", JSON.stringify(drafts));
    check(!S.formatOf(await stateOf("lineup")).events.some((e) => /blockAVote/.test(e.id)), "the games don't have Block a Vote yet");
    const r5 = (await rules()).ours.updates;
    check(r5.length === 2 && r5[0].status === "ask" && r5[0].lines.some((l) => /Block a Vote/.test(l)) && r5[1].status === "hidden" && r5[1].lines.length === 0, "alex (on 5): Episode 5's asks; Episode 6's is only counted", JSON.stringify(r5));
    check((await post("alex", { action: "update", edit: r5[1].id, take: true })).status === 403, "Episode 6's can't be answered before it's seen");
    await a.page.reload();
    await a.page.locator("[data-update='ask']").waitFor({ timeout: 20000 });
    check(/1 update from Episode 6/.test(await a.page.locator("[data-update-hidden]").innerText()), "the page: 1 update from Episode 6, shown once you've seen it");
    await fits(a.page, "the show's changes");
    await shot(a.page, "show-changes");
    await a.page.locator("[data-update-take]").click();
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    await a.page.locator("[data-guard-confirm]").click();
    check(/Added to your rulebook/.test(await toasted(a.page, /Added to your rulebook/)), "Add it");
    check((await pool.query("SELECT status FROM rulebook_edits WHERE rulebook_id = $1 AND from_episode = 5 AND NOT COALESCE((proposal->>'copied')::boolean, false)", [copyId])).rows[0].status === "in_force", "Episode 5's change in force on the copy");
    const lineupNow = await stateOf("lineup");
    const bav = S.formatOf(lineupNow).events.filter((e) => /^blockAVote/.test(e.id));
    check(bav.length > 0 && bav.every((e) => !e.retiredFrom), "the games have Block a Vote", JSON.stringify(bav.map((e) => e.id)));
    const ch6Id = (await pool.query("SELECT id FROM rulebook_edits WHERE rulebook_id = $1 AND from_episode = 6 AND status = 'in_force'", [seasonBook])).rows[0].id;
    const deskLine = (await as.desk.call("GET", `/api/desk/rulebooks/${seasonBook}`)).body.history.find((h) => h.undoable && /Episode 6/.test(h.text));
    check((await as.desk.call("POST", `/api/desk/changes/${deskLine.id}/undo`)).status === 200, "the desk takes the Episode 6 change back");
    check((await pool.query("SELECT status FROM rulebook_edits WHERE rulebook_id = $1 AND proposal->>'seasonEdit' = $2", [copyId, ch6Id])).rows[0].status === "withdrawn", "and it's gone from the copy's questions");
    check(!(await rules()).ours.updates.some((u) => u.status === "hidden"), "nothing waiting from Episode 6");
    const page2 = (await as.desk.call("GET", `/api/desk/rulebooks/${seasonBook}`)).body;
    const fixed = JSON.parse(JSON.stringify(page2.now));
    const reward = fixed.segments.find((s) => s.id === "rewardChallenge");
    reward.often = reward.often === "everyEpisode" ? "someEpisodes" : "everyEpisode";
    check((await as.desk.call("POST", `/api/desk/rulebooks/${seasonBook}`, { action: "save", kind: "fix", blocks: fixed })).status === 200, "the desk fixes a mistake in the season's rulebook");
    const blocks2 = (await pool.query("SELECT blocks FROM rulebooks WHERE id = $1", [copyId])).rows[0].blocks;
    check(blocks2.segments.find((s) => s.id === "rewardChallenge").often === reward.often, "the fix reached the copy");
    check(blocks2.customMoments.some((m) => m.id === mid) && blocks2.points[mid] === 2, "and the couch's own moment is still there");
    check((await linesOf("lineup", "rules.fix")).length === 1, "a line in Recent changes");

    // ---- 6. change the points ----
    await a.page.reload();
    await a.page.locator(`[data-change-points='${L.lineup}']`).click();
    const item = a.page.locator("[data-points='Weekly Lineup'] [data-points-item]").first();
    const itemId = await item.getAttribute("data-points-item");
    const was = S.ActiveRosterLogic.pointsFor(await stateOf("lineup"), itemId);
    await item.locator("button[aria-label='More']").click();
    await item.locator("button[aria-label='More']").click();
    await fits(a.page, "Change the points");
    await shot(a.page, "change-points");
    await a.page.locator("[data-points-save]").click();
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    await shot(a.page, "change-points-preview");
    await a.page.locator("[data-guard-confirm]").click();
    check(/Points saved/.test(await toasted(a.page, /Points saved/)), "Points saved");
    check(S.ActiveRosterLogic.pointsFor(await stateOf("lineup"), itemId) === was + 2, `${itemId}: ${was} → ${was + 2}`);
    const ptsLine = (await linesOf("lineup", "rules.points")).pop();
    check(ptsLine && (await undo(ptsLine.batch)).status === 200 && S.ActiveRosterLogic.pointsFor(await stateOf("lineup"), itemId) === was, "Undo puts the points back");
    check((await post("riley", { action: "points", leagueId: L.lineup, points: { [itemId]: 9 } })).status === 403, "riley can't change the points");

    // ---- 7. follow it again ----
    await a.page.reload();
    await a.page.locator("[data-follow-again]").click();
    await a.page.locator("[data-follow-summary]").waitFor({ timeout: 20000 });
    const summary = await a.page.locator("[data-follow-summary]").innerText();
    check(/turned off\s*None/.test(summary) && /1 removed/.test(summary) && /Stay as you set them/.test(summary), "previewed: nothing was turned off, your own moment goes, points stay", summary);
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor();
    await shot(a.page, "follow-again");
    await a.page.locator("[data-guard-confirm]").click();
    check(/Following it again/.test(await toasted(a.page, /Following it again/)), "Following it again");
    check((await pool.query("SELECT status FROM rulebooks WHERE id = $1", [copyId])).rows[0].status === "archived", "the copy is archived");
    check((await pool.query("SELECT count(*)::int AS n FROM leagues WHERE rulebook_id = $1", [copyId])).rows[0].n === 0 && (await Promise.all(couchA.map(rulebookOf))).every((r) => !r), "the games are back on their show's rules");
    check((await tables()) === startTables, "every table as it was at the start (the couch's own moment scores nothing)");
    const follow = (await linesOf("lineup", "rules.follow")).pop();
    check((await undo(follow.batch)).status === 200, "Undo from Recent changes");
    check((await pool.query("SELECT status FROM rulebooks WHERE id = $1", [copyId])).rows[0].status === "in_force" && (await Promise.all(couchA.map(rulebookOf))).every((r) => r?.id === copyId), "the copy's back, and the games play by it");
    check((await pointsIn("lineup", mid)) === 6, "and the couch's own moment counts again");

    // ---- 8. a correction that adds ----
    const ori = (await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, confidence)
       VALUES ($1, 5, 'event', 'Ori Jean Charles', '', 'idolFound', 'pending', 'disputed', true, 'medium') RETURNING id`,
      [sid]
    )).rows[0].id;
    // A result someone sent (a season whose couches fill in results takes only those): jordan's answer said so.
    const key = (await pool.query("SELECT show_id, season_number FROM show_seasons WHERE id = $1", [sid])).rows[0];
    const cast = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [sid])).rows.map((r) => r.name);
    const sent = (await pool.query(
      `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers)
       VALUES ($1, $2, 5, '{"facts": []}', '{}', 'paste', $3, $4, $5) RETURNING id`,
      [key.show_id, key.season_number, fx.users.jordan, fx.couchId, JSON.stringify({ people: cast, kinds: null })]
    )).rows[0].id;
    await pool.query("INSERT INTO fact_sources (decision_id, research_id, method, confidence) VALUES ($1, $2, '', 'medium')", [ori, sent]);
    const oriIn = async (k) => {
      const s = await stateOf(k);
      const name = new Map(s.castaways.map((c) => [c.id, c.name]));
      return s.episodes.find((e) => e.number === 5).scoringEvents.some((e) => e.type === "idolFound" && name.get(e.castawayId) === "Ori Jean Charles");
    };
    check((await as.desk.call("POST", `/api/desk/facts/${ori}`, { decide: "yes" })).status === 200, "the desk decides Ori found an idol in Episode 5");
    check((await oriIn("lineup")) && (await oriIn("extra")), "it reaches every game on the season");
    const added = (await linesOf("lineup", "results.correction")).pop();
    check(added && /Episode 5 corrected/.test(added.text), "Episode 5 was final: a correction line", JSON.stringify(added));
    const bs = (await as.alex.call("GET", `/api/seasons/${sid}/backstage${A}&episode=5`)).body;
    const corr = bs.corrections.find((c) => c.decisionId === ori);
    check(corr && corr.change === "added", "Backstage › Results: Added", JSON.stringify(bs.corrections).slice(0, 300));
    await a.page.goto(`${a.BASE}/show/${sid}/backstage/results?ep=5`);
    await a.page.locator(`[data-correction='${ori}']`).waitFor({ timeout: 20000 });
    await a.page.locator(`[data-correction='${ori}']`).scrollIntoViewIfNeeded();
    check(/Added: Ori · Idol/.test(await a.page.locator(`[data-correction='${ori}']`).innerText()) && /Don't count it in our games/.test(await a.page.locator(`[data-correction='${ori}'] [data-keep-old]`).innerText()), "the card: Added, and Don't count it in our games");
    await fits(a.page, "a correction that adds");
    await shot(a.page, "correction-added");
    await a.page.locator(`[data-correction='${ori}'] [data-keep-old]`).click();
    await a.page.locator("[data-guard-confirm]:not([disabled])").waitFor({ timeout: 20000 });
    check(/Not counted here/.test(await a.page.locator("[data-guard='2']").innerText()), "previewed: not counted here");
    await shot(a.page, "refuse-added");
    await a.page.locator("[data-guard-confirm]").click();
    await toasted(a.page, /House ruling saved/);
    const ruling = (await pool.query("SELECT league_id, keeps FROM league_rulings WHERE decision_id = $1", [ori])).rows;
    check(ruling.length === 3 && ruling.every((r) => r.keeps.absent === true), "a ruling in couch A's three games that keeps it out", JSON.stringify(ruling.map((r) => r.keeps.absent)));
    check(!(await oriIn("lineup")) && (await oriIn("extra")), "out of couch A's games, still in couch B's");
    const ep5 = (await as.jordan.call("GET", `/api/seasons/${sid}/results/5${A}`)).body;
    const plate = ep5.corrections.find((c) => c.decisionId === ori);
    check(plate && plate.change === "added" && plate.ruling, "jordan's Episode 5: added, with the house ruling", JSON.stringify(plate).slice(0, 200));
    await episodePage(5);
    await j.page.locator("[data-house-ruling]").waitFor({ timeout: 20000 });
    check(/doesn't count in your games/.test(await j.page.locator("[data-house-ruling]").innerText()), "the episode page: it doesn't count in your games");
    await fits(j.page, "the episode page");
    await shot(j.page, "episode-refused");
    await j.page.locator("[data-couch-moments='5']").scrollIntoViewIfNeeded();
    check(/settled by whoever runs the games/.test(await j.page.locator(`[data-couch-moment='${mid}'] [data-couch-status]`).innerText()), "the couch's moment on Episode 5: settled by whoever runs the games");
    await shot(j.page, "couch-moments-settled");
    await a.page.locator(`[data-correction='${ori}'] [data-drop-ruling]`).click();
    await toasted(a.page, /Ruling dropped/);
    check(await oriIn("lineup"), "Drop the ruling: it counts in couch A's games again");

    // ---- 9. nothing real moved ----
    check(JSON.stringify((await pool.query(REAL_LEAGUES)).rows) === JSON.stringify(realBefore), "every real league's state is as it was");
    for (const [who, b, list] of [["alex", a, aFailed], ["jordan", j, jFailed]]) {
      const errs = b.errors.filter((e) => !/Failed to load resource/.test(e));
      const bad = list.filter((x) => !/^(400|403|409) /.test(x));
      check(!errs.length && !bad.length, `no page errors (${who})`, [...errs, ...bad].join(" | "));
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
