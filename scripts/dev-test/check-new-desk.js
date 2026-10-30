// Dev-only check for the admin's desk and the rulebook editor (docs/PLAN-new-design.md step 6b, part 2), against the
// dev server, on new-fixture.js: couch A ("ZT Survivor 51": alex runs its three games, jordan and sam play) and couch B
// ("ZT Extra": alex and casey) on one zt Survivor 51, results through Episode 5; the zt Traitors season, whose cast
// carries its faction as a tribe (as Traitors 5's wiki does). Added here: the desk's own admin (zt_nd_desk, site role
// admin, on no couch), a game on the Traitors season for couch A, a split result (Ori's idol on Episode 5: jordan's
// answer says so, casey's full answer doesn't), and couch B's game with nobody running it (alex stepped down).
//   1. Only site admins: alex (a commissioner) is refused every desk route and sees "The desk is for site admins".
//   2. Suggest a fix: jordan sends one from How it works.
//   3. The Inbox, from the profile menu's Admin row: the split, the stranded couch, the Merged start to confirm (only
//      once research says it began) and jordan's suggestion; nothing of the real seasons is asserted on.
//   4. A fact: both sides with who said what; Yes (canonical, locked: every league on the season gets it), Undo from
//      History (settled again, out of every league), No then Reopen, and an edit (it was Danny's) undone.
//   5. Find and a castaway: Override the name (every league renames them), Undo; a group override; Lock (a
//      commissioner's cast edit is refused), unlock.
//   6. A couch: hand the stranded game to casey; Override who fills in results, undone.
//   7. The Traitors' faction-as-tribe: the season page says the groups are a secret role; Take out Traitor (previewed:
//      2 people, 1 league), off the cast and out of the game with a Recent changes line; Faithful too, then undone.
//   8. The rulebook: confirm when Merged started (undone); Fix a mistake (Reward challenge every episode) and The show
//      changed from Episode 6 (a new advantage) in the editor; Leagues play by it (all four zt games get it); How it
//      works for jordan (seen 5) counts the update and doesn't tell it; a fix after it's live reaches the games; the
//      show change undone; Check for changes (prompt, a pasted answer reviewed, its changes put in the draft,
//      discarded); the suggestion marked fixed; Lock; Save as a starting point; Leagues back on the show's rules.
//   9. Settings: Sources to confirm a result 3, and new couches' who-fills-in, both put back.
//  10. Nothing real moved: every real league's state and every real season's results are as they were.
//  11. Screens at --width: each page and sheet above. Nothing wider than the screen; no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                              (in another terminal)
//   node scripts/dev-test/check-new-desk.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only, and puts back the two site
// settings it changes (app_settings confirm_at and new_couch_fill) as they were; never turns the rulebooks flag on.
// Refuses a non-local database. Prints PASS/FAIL.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-desk runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-desk.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const DESK = fixture.username("desk");
const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";
const REAL_RESULTS = `SELECT md5(string_agg(d.id::text || d.status || COALESCE(d.fact_status, '') || d.decided_at::text, ',' ORDER BY d.id)) AS h
  FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const { rows: settingsBefore } = await pool.query("SELECT key, value FROM app_settings WHERE key IN ('confirm_at', 'new_couch_fill', 'rulebooks')");
  const realBefore = { leagues: (await pool.query(REAL_LEAGUES)).rows, results: (await pool.query(REAL_RESULTS)).rows[0].h };
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    const L = fx.leagues;
    const A = `?couch=${fx.couchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);

    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on no couch, so they run nothing.
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

    // Every real game's castaways are linked to their season's cast (that's how an admin's rename reaches them); the
    // fixture's aren't, so link them here.
    for (const k of ["outlast", "lineup", "pool", "extra"]) {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues[k]]);
      const ids = new Map((await pool.query("SELECT id, name FROM season_cast WHERE season_id = $1", [sid])).rows.map((r) => [r.name, r.id]));
      for (const c of rows[0].state.castaways) if (ids.has(c.name)) c.seasonCastId = ids.get(c.name);
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [fx.leagues[k], JSON.stringify(rows[0].state)]);
    }

    // A game on the Traitors season for couch A (alex runs it), its cast in their factions as tribes, as the wiki has
    // it. Its cast is still being made, by this game, so its commissioner can correct it (until an admin locks someone).
    const { rows: tcast } = await pool.query("SELECT id, name, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [tid]);
    const st = S.defaultState();
    S.ensureNextEpisode(st);
    Object.assign(st.settings, { showId: "zt-nd-traitors", wikiSeason: "5" });
    const tribes = { Traitor: S.addTribe(st, "Traitor", "#b3261e"), Faithful: S.addTribe(st, "Faithful", "#2e7d32") };
    for (const c of tcast) {
      const k = S.addCastaway(st, c.name);
      k.tribeId = k.startTribeId = tribes[c.tribe_name].id;
      k.seasonCastId = c.id;
    }
    const tp = S.addPlayer(st, fixture.username("alex"));
    const traitorsGame = (await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('ZT Traitors game', 'zt-nd-traitors-game', $1, $2, $3, $4) RETURNING id`,
      [`ZT${crypto.randomBytes(3).toString("hex").toUpperCase()}`, JSON.stringify(st), fx.users.alex, fx.couchId]
    )).rows[0].id;
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'commissioner')", [traitorsGame, fx.users.alex, tp.id]);
    await pool.query("UPDATE show_seasons SET cast_created_by_league = $2, cast_locked_at = NULL WHERE id = $1", [tid, traitorsGame]);

    // A split: Ori's idol on Episode 5. jordan's answer says so; casey's full answer for the episode (everyone in the cast
    // answered for) doesn't.
    const cast = (await pool.query('SELECT name FROM season_cast WHERE season_id = $1', [sid])).rows.map((r) => r.name);
    const { rows: key } = await pool.query("SELECT show_id, season_number FROM show_seasons WHERE id = $1", [sid]);
    const ori = (await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, confidence)
       VALUES ($1, 5, 'event', 'Ori Jean Charles', '', 'idolFound', 'pending', 'disputed', true, 'medium') RETURNING id`,
      [sid]
    )).rows[0].id;
    const answer = async (who, couch) =>
      (await pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers)
         VALUES ($1, $2, 5, '{"facts": []}', '{}', 'paste', $3, $4, $5) RETURNING id`,
        [key[0].show_id, key[0].season_number, fx.users[who], couch, JSON.stringify({ people: cast, kinds: null })]
      )).rows[0].id;
    const jordansAnswer = await answer("jordan", fx.couchId);
    await pool.query("INSERT INTO fact_sources (decision_id, research_id, method, confidence) VALUES ($1, $2, '', 'medium')", [ori, jordansAnswer]);
    await answer("casey", fx.extraCouchId);
    // Couch B's game with nobody running it.
    await pool.query("UPDATE league_memberships SET role = 'member' WHERE league_id = $1 AND user_id = $2", [L.extra, fx.users.alex]);

    const zt = ["outlast", "lineup", "pool", "extra"];
    const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const ep5 = async (k) => {
      const s = await stateOf(L[k]);
      const name = new Map(s.castaways.map((c) => [c.id, c.name]));
      return (s.episodes.find((e) => e.number === 5)?.scoringEvents || []).map((e) => `${name.get(e.castawayId)}:${e.type}`);
    };
    const everywhere = async (what) => (await Promise.all(zt.map(ep5))).every((e) => e.includes(what));
    const nowhere = async (what) => (await Promise.all(zt.map(ep5))).every((e) => !e.includes(what));
    const factRow = async () => (await pool.query("SELECT status, fact_status, locked_at, applied FROM season_decisions WHERE id = $1", [ori])).rows[0];

    const as = { desk: await api({ user: DESK, pass: fixture.PASSWORD }) };
    for (const who of ["alex", "jordan", "sam"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.alex.call("GET", "/api/desk/inbox"),
      as.alex.call("GET", "/api/desk/find?q=ZT"),
      as.alex.call("GET", `/api/desk/seasons/${sid}`),
      as.alex.call("POST", `/api/desk/facts/${ori}`, { decide: "yes" }),
      as.alex.call("PUT", "/api/desk/settings", { confirmAt: 3 }),
    ]);
    check(refused.every((r) => r.status === 403), "a commissioner is refused every desk route", refused.map((r) => r.status).join(","));
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    check(!!rb && season.rulebook.live === false && season.aired === 5, "the desk's season page: its rulebook (not live), 5 aired", JSON.stringify(season.rulebook));

    // ---- browsers ----
    const ui = (b) => {
      const failed = [];
      b.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(b.BASE, "")}`));
      return failed;
    };
    const hideOverlay = (b) =>
      b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
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
    const closeSheet = async (page) => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(450);
    };

    const al = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(al.close);
    await hideOverlay(al);
    await al.page.goto(`${al.BASE}/desk`);
    await al.page.getByText("The desk is for site admins").waitFor({ timeout: 20000 });
    check(true, "alex's /desk: The desk is for site admins");
    await shot(al.page, "desk-refused");

    // ---- 2. Suggest a fix, from How it works ----
    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(j.close);
    const jFailed = ui(j);
    await hideOverlay(j);
    await j.page.goto(`${j.BASE}/show/${sid}/games`);
    await j.page.getByRole("button", { name: /^How .* works/ }).click({ timeout: 20000 });
    await j.page.waitForURL(/\?page=how-it-works/);
    await j.page.locator("[data-suggest-fix]").waitFor({ timeout: 20000 });
    await j.page.locator("[data-suggest-fix]").scrollIntoViewIfNeeded();
    await j.page.locator("[data-suggest-fix]").click();
    await j.page.locator("[data-suggest-sheet]").waitFor();
    check(await j.page.locator("[data-suggest-send]").isDisabled(), "Suggest a fix: Send waits for what it's about and what's off");
    await j.page.locator("[data-about='segment']").click();
    await j.page.locator("[data-suggest-note]").fill("Reward challenges are every episode this season");
    await fits(j.page, "Suggest a fix");
    await shot(j.page, "suggest-fix");
    await j.page.locator("[data-suggest-send]").click();
    check(/Sent/.test(await toasted(j.page, /Sent/)), "jordan's suggestion is sent");
    const tip = (await pool.query("SELECT id, rulebook_id, couch_id, about, status FROM rulebook_suggestions WHERE season_id = $1", [sid])).rows;
    check(tip.length === 1 && tip[0].rulebook_id === rb && tip[0].couch_id === fx.couchId && tip[0].about === "segment", "it's on the season's rulebook, from couch A", JSON.stringify(tip));
    check((await as.sam.call("POST", `/api/seasons/${sid}/rulebook/suggest${A}`, { about: "scores", note: "" })).status === 400, "a suggestion needs a note");

    // ---- 3. the Inbox, from the profile menu ----
    // Merged starts when 12 are left: 14 went into Episode 5 and nothing says it began, so there's nothing to confirm yet.
    const early = (await as.desk.call("GET", "/api/desk/inbox")).body;
    check(!early.items.some((i) => i.kind === "phase" && /ZT Survivor 51/.test(i.title)), "Inbox: no Merged start to confirm before anything says it began", JSON.stringify(early.items.map((i) => i.title)));
    // jordan's answer says the game merged in Episode 5.
    await pool.query(`UPDATE episode_research SET payload = payload || '{"merged": "yes"}' WHERE id = $1`, [jordansAnswer]);
    const inbox = (await as.desk.call("GET", "/api/desk/inbox")).body;
    const item = (kind, re) => inbox.items.find((i) => i.kind === kind && re.test(i.title + i.line));
    check(!!item("split", /Ori Jean Charles/) && item("split", /Ori/).href === `/desk/fact/${ori}`, "Inbox: Ori's idol, the sources split", JSON.stringify(inbox.items.map((i) => i.title)));
    check(!!item("stranded", /ZT Extra/), "Inbox: ZT Extra has no one running it");
    check(
      !!item("phase", /ZT Survivor 51.*Merged.*Research says it began in Episode 5/) && item("phase", /ZT Survivor 51/).href === `/desk/rulebook/${rb}`,
      "Inbox: when did the Merged start (ZT Survivor 51), once research says it began",
      JSON.stringify(item("phase", /ZT Survivor 51/))
    );
    check(!!item("suggestion", /ZT Survivor 51/) && /zt_nd_jordan/.test(item("suggestion", /ZT Survivor 51/).line), "Inbox: jordan's suggested fix");
    check(!inbox.items.some((i) => i.kind === "stranded" && i.href === `/desk/couch/${fx.couchId}`), "couch A's games are run, so it isn't stranded");

    const d = await open({ user: DESK, pass: fixture.PASSWORD, width, height: 844 });
    closers.push(d.close);
    const dFailed = ui(d);
    await hideOverlay(d);
    await d.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: d.BASE });
    await d.page.goto(`${d.BASE}/`);
    await d.page.getByRole("button", { name: "Your profile" }).click();
    await d.page.locator("[data-admin-row]").waitFor({ timeout: 20000 });
    await d.page.waitForFunction(() => /need/.test(document.querySelector("[data-admin-row]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(new RegExp(`${inbox.items.length} needs? you`).test(await d.page.locator("[data-admin-row]").innerText()), "the profile menu's Admin row says how many need you", await d.page.locator("[data-admin-row]").innerText());
    await shot(d.page, "profile-admin-row");
    await d.page.locator("[data-admin-row]").click();
    await d.page.waitForURL(/\/desk$/);
    await d.page.locator("[data-inbox]").waitFor({ timeout: 20000 });
    for (const k of ["split", "stranded", "phase", "suggestion"]) check((await d.page.locator(`[data-inbox] [data-desk-item='${k}']`).count()) >= 1, `the Inbox screen lists the ${k}`);
    await fits(d.page, "the Inbox");
    await shot(d.page, "inbox");

    // ---- 4. a fact ----
    await d.page.locator("[data-desk-item='split']", { hasText: "Ori Jean Charles" }).click();
    await d.page.locator("[data-desk-fact='disputed']").waitFor({ timeout: 20000 });
    const factText = await d.page.locator("[data-desk-fact]").innerText();
    check(factText.includes("zt_nd_jordan") && factText.includes("zt_nd_casey"), "the fact: who said it happened (jordan) and who didn't (casey)");
    await fits(d.page, "a fact");
    await shot(d.page, "fact");
    await d.page.locator("[data-decide='yes']").click();
    await d.page.locator("[data-guard-confirm]:not([disabled])").waitFor();
    await shot(d.page, "fact-decide");
    await d.page.locator("[data-guard-confirm]").click();
    await d.page.locator("[data-desk-fact='canonical']").waitFor({ timeout: 20000 });
    let f = await factRow();
    check(f.status === "accepted" && f.fact_status === "canonical" && !!f.locked_at, "Yes: canonical and locked", JSON.stringify(f));
    check(await everywhere("Ori Jean Charles:idolFound"), "every league on the season gets it, couch B's too");
    await d.page.locator("[data-undo-desk]").first().click();
    await d.page.locator("[data-desk-fact='disputed']").waitFor({ timeout: 20000 });
    f = await factRow();
    check(f.status === "pending" && f.fact_status === "disputed" && !f.locked_at, "History's Undo: settled again from its sources, disputed", JSON.stringify(f));
    check(await nowhere("Ori Jean Charles:idolFound"), "and out of every league");
    await shot(d.page, "fact-undone");
    const no = await as.desk.call("POST", `/api/desk/facts/${ori}`, { decide: "no" });
    check(no.status === 200 && no.body.status === "removed" && !!no.body.locked, "No: removed for everyone, locked");
    const reopen = await as.desk.call("POST", `/api/desk/facts/${ori}`, { reopen: true });
    check(reopen.status === 200 && reopen.body.status === "disputed" && !reopen.body.locked, "Reopen: unlocked and settled again (still split)", JSON.stringify(reopen.body.status));
    check((await as.desk.call("POST", `/api/desk/facts/${ori}`, { edit: { castawayName: "Nobody Atall" } })).status === 400, "an edit has to name someone in the cast");
    const edit = await as.desk.call("POST", `/api/desk/facts/${ori}`, { edit: { castawayName: "Danny Kilby" } });
    check(edit.status === 200 && edit.body.applied?.castawayName === "Danny Kilby" && edit.body.status === "canonical", "Edit: it was Danny's (canonical, locked)");
    check((await everywhere("Danny Kilby:idolFound")) && (await nowhere("Ori Jean Charles:idolFound")), "every league scores Danny's idol, not Ori's");
    const editLine = edit.body.history.find((h) => h.undoable);
    check((await as.desk.call("POST", `/api/desk/changes/${editLine.id}/undo`)).status === 200 && (await nowhere("Danny Kilby:idolFound")), "the edit undone: Danny's idol out again");
    check((await as.desk.call("POST", `/api/desk/changes/${editLine.id}/undo`)).status === 409, "an undone change can't be undone twice");

    // ---- 5. Find, and a castaway ----
    // The fixture's Eric, not the local copy's real Survivor 51 one (Find lists both; picking the first was Noticed ab's flake).
    await d.page.goto(`${d.BASE}/desk/find`);
    await d.page.locator("[data-find]").fill("Eric Mack");
    await d.page.locator("[data-desk-item='castaway']", { hasText: "Eric Macksoud" }).filter({ hasText: "Cast · ZT" }).first().waitFor({ timeout: 20000 });
    await fits(d.page, "Find");
    await shot(d.page, "find");
    await d.page.locator("[data-desk-item='castaway']", { hasText: "Eric Macksoud" }).filter({ hasText: "Cast · ZT" }).first().click();
    await d.page.locator("[data-desk-castaway]").waitFor({ timeout: 20000 });
    const castId = d.page.url().split("/").pop();
    await d.page.locator("[data-override='name']").click();
    await d.page.locator("[data-override-input]").fill("Eric Macksoud Jr");
    await fits(d.page, "Override");
    await shot(d.page, "override");
    await d.page.locator("[data-override-save]").click();
    check(/Renamed Eric Macksoud Jr in \d+ games?/.test(await toasted(d.page, /Renamed/)), "Override saved");
    const named = async (name) => (await Promise.all(zt.map(async (k) => (await stateOf(L[k])).castaways.filter((c) => c.name === name).length))).every((x) => x === 1);
    const ericIn = async () => JSON.stringify(Object.fromEntries(await Promise.all(zt.map(async (k) => [k, (await stateOf(L[k])).castaways.filter((c) => /^Eric/.test(c.name)).map((c) => `${c.name}${c.seasonCastId ? "" : " (unlinked)"}`)]))));
    check(
      (await named("Eric Macksoud Jr")) && (await Promise.all(zt.map(async (k) => (await stateOf(L[k])).castaways.some((c) => c.name === "Eric Macksoud")))).every((x) => !x),
      "every league renames him (no one added)",
      await ericIn()
    );
    await d.page.locator("[data-desk-castaway] [data-undo-desk]").first().click();
    await toasted(d.page, /Undone/);
    await d.page.waitForTimeout(600);
    check(await named("Eric Macksoud"), "Undo: his name back in every league");
    const groupBefore = (await pool.query("SELECT tribe_name FROM season_cast WHERE id = $1", [castId])).rows[0].tribe_name;
    const other = ["Toka", "Savu", "Dina"].find((t) => t !== groupBefore);
    const grp = await as.desk.call("POST", `/api/desk/castaways/${castId}`, { field: "group", value: other });
    check(grp.status === 200 && grp.body.group === other, `a group override: ${groupBefore} to ${other}`, JSON.stringify(grp.body).slice(0, 200));
    await as.desk.call("POST", `/api/desk/changes/${grp.body.history.find((h) => h.undoable).id}/undo`);
    check((await pool.query("SELECT tribe_name FROM season_cast WHERE id = $1", [castId])).rows[0].tribe_name === groupBefore, "and undone");
    await d.page.reload();
    await d.page.locator("[data-lock='off']").click();
    await d.page.locator("[data-lock='on']").waitFor({ timeout: 15000 });
    check(!!(await pool.query("SELECT locked_at FROM season_cast WHERE id = $1", [castId])).rows[0].locked_at, "Lock: Eric locked");
    // A lock matters while a game is still making the season's cast: the Traitors game is.
    const ada = (await pool.query("SELECT id FROM season_cast WHERE season_id = $1 AND name = 'Ada Moss'", [tid])).rows[0].id;
    const adaInGame = (await stateOf(traitorsGame)).castaways.find((c) => c.name === "Ada Moss").id;
    const rename = (value) => as.alex.call("PATCH", `/api/leagues/${traitorsGame}/castaways/${adaInGame}`, { field: "name", value });
    await as.desk.call("POST", `/api/desk/castaways/${ada}`, { lock: true });
    const commish = await rename("Ada M");
    check(commish.status === 403 && /admin has locked Ada Moss/.test(commish.body.error), "locked: the commissioner making the cast can't change her", JSON.stringify(commish));
    await as.desk.call("POST", `/api/desk/castaways/${ada}`, { lock: false });
    check((await rename("Ada M")).status === 200 && (await rename("Ada Moss")).status === 200, "unlocked, they can again");
    await shot(d.page, "castaway-locked");
    await fits(d.page, "a castaway");
    await d.page.locator("[data-lock='on']").click();
    await d.page.locator("[data-lock='off']").waitFor({ timeout: 15000 });
    check(!(await pool.query("SELECT locked_at FROM season_cast WHERE id = $1", [castId])).rows[0].locked_at, "and unlocked");

    // ---- 6. a couch ----
    await d.page.goto(`${d.BASE}/desk`);
    await d.page.locator("[data-desk-item='stranded']", { hasText: "ZT Extra" }).click();
    await d.page.locator(`[data-stranded='${L.extra}']`).waitFor({ timeout: 20000 });
    await fits(d.page, "a couch");
    await shot(d.page, "couch-stranded");
    // Hand it on (docs/PLAN-desk-parity.md step 2): the hand-on sheet, with nobody going.
    await d.page.locator("[data-hand-couch]").click();
    await d.page.locator(`[data-hand-pick='${fixture.username("casey")}']`).click();
    await d.page.locator("[data-hand-go]").click();
    await toasted(d.page, /runs .* now/);
    const role = (await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [L.extra, fx.users.casey])).rows[0].role;
    check(role === "commissioner", "casey runs couch B's game now", role);
    check(!(await as.desk.call("GET", "/api/desk/inbox")).body.items.some((i) => i.kind === "stranded" && /ZT Extra/.test(i.title)), "and it's off the Inbox");
    const fill = await as.desk.call("POST", `/api/desk/couches/${fx.extraCouchId}`, { anyone: false });
    check(fill.status === 200 && fill.body.anyone === false, "Override: only people who run games fill in couch B's results");
    await as.desk.call("POST", `/api/desk/changes/${fill.body.history.find((h) => h.undoable).id}/undo`);
    check((await pool.query("SELECT results_by_anyone FROM couches WHERE id = $1", [fx.extraCouchId])).rows[0].results_by_anyone === true, "and undone");

    // ---- 7. the Traitors' faction-as-tribe ----
    await d.page.goto(`${d.BASE}/desk/find`);
    await d.page.locator("[data-find]").fill("ZT Traitors");
    await d.page.locator("[data-desk-item='season']", { hasText: "ZT Traitors" }).first().click();
    await d.page.locator("[data-desk-season]").waitFor({ timeout: 20000 });
    await fits(d.page, "a season");
    // Its groups are on its Cast page (docs/PLAN-desk-parity.md part 5a).
    await d.page.locator("[data-desk-row='cast']").click();
    await d.page.locator("[data-desk-cast]").waitFor({ timeout: 20000 });
    check((await d.page.locator("[data-clear-group]").count()) === 2, "the Traitors' Cast page: both groups are a secret role");
    await shot(d.page, "traitors-season");
    // Not a faction on Traitor takes Faithful with it (docs/PLAN-desk-parity.md part 5b): one left would still give the role away.
    await d.page.locator("[data-clear-group='Traitor']").click();
    await d.page.locator("[data-moves]").waitFor({ timeout: 15000 });
    await d.page.waitForTimeout(600);
    const preview = await d.page.locator("[data-moves]").innerText();
    check(/8 start in Faithful/.test(preview) && /2 start in Traitor/.test(preview) && /Its 1 game/.test(preview), "previewed together: 8 in Faithful, 2 in Traitor, 1 game", preview);
    await shot(d.page, "clear-group");
    await d.page.locator("[data-guard-confirm]").click();
    await toasted(d.page, /taken out/);
    const tState = await stateOf(traitorsGame);
    check(!tState.tribes.some((t) => t.name === "Traitor" || t.name === "Faithful"), "the game has neither group");
    check((await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1 AND tribe_name IN ('Traitor', 'Faithful')", [tid])).rows[0].n === 0, "and nor does the season's cast");
    const castLine = (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 AND kind = 'cast'", [traitorsGame])).rows;
    check(castLine.filter((l) => /secret role/.test(l.text)).length === 1, "the game's Recent changes say why", JSON.stringify(castLine));
    const tCast = (await as.desk.call("GET", `/api/desk/seasons/${tid}/cast`)).body;
    check(tCast.groups.length === 0, "no groups left on the Traitors");
    await as.desk.call("POST", `/api/desk/changes/${tCast.history.find((h) => h.undoable && /Faithful and Traitor/.test(h.text)).id}/undo`);
    check((await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1 AND tribe_name = 'Faithful'", [tid])).rows[0].n === 8, "Undo: Faithful and Traitor back on the same people");
    const again = await as.desk.call("POST", `/api/desk/seasons/${tid}`, { clearGroup: "Faithful" });
    check(again.status === 200 && again.body.people === 10 && again.body.leagues === 1, "taken out again, from Faithful: Traitor goes with it", JSON.stringify(again.body));

    // ---- 8. the rulebook ----
    await d.page.goto(`${d.BASE}/desk/rulebook/${rb}`);
    await d.page.locator("[data-desk-rulebook='1']").waitFor({ timeout: 20000 });
    await fits(d.page, "the rulebook");
    await shot(d.page, "rulebook");
    await d.page.locator("[data-confirm-phase='merged'] [data-phase-episode='5']").click();
    await toasted(d.page, /Merged started in Episode 5/);
    check((await pool.query("SELECT phase_starts FROM rulebooks WHERE id = $1", [rb])).rows[0].phase_starts.merged === 5, "Merged confirmed as Episode 5");
    check(!(await as.desk.call("GET", "/api/desk/inbox")).body.items.some((i) => i.kind === "phase" && /ZT Survivor 51/.test(i.title)), "and it's off the Inbox");
    await d.page.locator("[data-undo-desk]").first().click();
    await toasted(d.page, /Undone/);
    await d.page.waitForTimeout(500);
    check((await pool.query("SELECT phase_starts FROM rulebooks WHERE id = $1", [rb])).rows[0].phase_starts.merged == null, "History's Undo: Merged's start unset again");

    // Fix a mistake: the Reward challenge is every episode.
    await d.page.locator("[data-part='segments']").click();
    await d.page.locator("[data-item='rewardChallenge']").click();
    await d.page.locator("[data-segment-sheet='rewardChallenge']").waitFor();
    await d.page.locator("[data-segment-sheet] [data-question='often'] [data-answer='everyEpisode']").click();
    await fits(d.page, "a segment's editor");
    await shot(d.page, "segment-editor");
    await d.page.locator("[data-segment-sheet] [data-done]").click();
    await d.page.locator("[data-list-sheet]").waitFor();
    await closeSheet(d.page);
    await d.page.locator("[data-unsaved='1']").waitFor({ timeout: 10000 });
    check((await d.page.locator("[data-unsaved]").innerText()).includes("Reward challenge: how often"), "1 unsaved change: Reward challenge, how often");
    await fits(d.page, "the rulebook with a change");
    await shot(d.page, "unsaved");
    await d.page.locator("[data-save]").click();
    await d.page.locator("[data-save-sheet]").waitFor();
    check((await d.page.locator("[data-impact]").innerText()).includes("still play by the show's rules"), "Save: it says the leagues aren't on it yet");
    await shot(d.page, "save-fix");
    await d.page.locator("[data-save-confirm]").click();
    await toasted(d.page, /Fixed/);
    await d.page.locator("[data-desk-rulebook='2']").waitFor({ timeout: 20000 });
    const fixed = (await pool.query("SELECT version, blocks FROM rulebooks WHERE id = $1", [rb])).rows[0];
    check(fixed.version === 2 && fixed.blocks.segments.find((s) => s.id === "rewardChallenge").often === "everyEpisode", "fixed in the rulebook itself: version 2", `v${fixed.version}`);

    // The show changed from Episode 6: a new advantage.
    await d.page.locator("[data-part='twists']").click();
    await d.page.locator("[data-list-sheet] [data-add]").click();
    await d.page.locator("[data-twist-sheet='new'] [data-question='type'] [data-answer='advantage']").click();
    await d.page.locator("[data-twist-sheet] [data-text='name']").fill("Block a Vote");
    await d.page.locator("[data-twist-sheet] [data-text='oneIsCalled']").fill("a Block a Vote");
    await fits(d.page, "a twist's editor");
    await shot(d.page, "twist-editor");
    await d.page.locator("[data-twist-sheet] [data-done]").click();
    await d.page.locator("[data-list-sheet] [data-item='blockAVote']").waitFor();
    await closeSheet(d.page);
    await d.page.locator("[data-unsaved]").waitFor();
    await d.page.locator("[data-save]").click();
    await d.page.locator("[data-save-sheet] [data-kind='show_changed']").click();
    check((await d.page.locator("[data-question='from'] [data-value]").innerText()).trim() === "6", "The show changed: from Episode 6, the next one");
    await shot(d.page, "save-show-changed");
    await d.page.locator("[data-save-confirm]").click();
    await toasted(d.page, /the show changed from Episode 6/);
    await d.page.locator("[data-desk-rulebook='3']").waitFor({ timeout: 20000 });
    check((await d.page.locator("[data-timeline] [data-edit='6']").innerText()).includes("Block a Vote"), "the Timeline: Episode 6, + New advantage: Block a Vote");
    const edits = (await pool.query("SELECT kind, from_episode, status FROM rulebook_edits WHERE rulebook_id = $1 AND source = 'admin'", [rb])).rows;
    check(edits.length === 1 && edits[0].from_episode === 6 && edits[0].status === "in_force", "a show change from Episode 6, in force", JSON.stringify(edits));
    check((await pool.query("SELECT 1 FROM leagues WHERE id = ANY($1::uuid[]) AND state->'settings' ? 'rulebook'", [zt.map((k) => L[k])])).rowCount === 0, "the games aren't on it yet");

    // Leagues play by it.
    await d.page.locator("[data-live='off']").click();
    await toasted(d.page, /play by this rulebook now/);
    const onIt = (await pool.query("SELECT slug, (state->'settings'->'rulebook'->>'version')::int AS v FROM leagues WHERE id = ANY($1::uuid[])", [zt.map((k) => L[k])])).rows;
    check(onIt.length === 4 && onIt.every((r) => r.v === 3), "all four zt games play by it, version 3", JSON.stringify(onIt));
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'rulebooks'")).rows[0]?.value !== true, "the rulebooks flag is still off (one season is)");
    const howJ = (await as.jordan.call("GET", `/api/seasons/${sid}/how-it-works${A}`)).body.how;
    check(howJ.updates.hidden?.from === 6 && !howJ.updates.shown.some((u) => u.episode === 6), "How it works for jordan (seen 5): one update from Episode 6, counted, not told", JSON.stringify(howJ.updates));
    check(!(howJ.twists?.items ?? []).some((t) => t.name === "Block a Vote"), "and Block a Vote isn't on his page yet");
    await d.page.locator("[data-read-it]").click();
    await d.page.getByText("Block a Vote").first().waitFor({ timeout: 15000 });
    check(true, "Read it: the desk reads it all, Block a Vote included");
    await shot(d.page, "read-it");
    await closeSheet(d.page);

    // A fix once it's live reaches the games; the show change undone.
    const page3 = (await as.desk.call("GET", `/api/desk/rulebooks/${rb}`)).body;
    const back = JSON.parse(JSON.stringify(page3.now));
    back.segments.find((s) => s.id === "rewardChallenge").often = "someEpisodes";
    const fix2 = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "save", kind: "fix", blocks: back });
    check(fix2.status === 200 && fix2.body.push.written === 4, "a fix after it's live reaches the four games", JSON.stringify(fix2.body.push));
    check((await pool.query("SELECT count(*)::int AS n FROM leagues WHERE id = ANY($1::uuid[]) AND (state->'settings'->'rulebook'->>'version')::int = 4", [zt.map((k) => L[k])])).rows[0].n === 4, "at version 4");
    const showLine = fix2.body.page.history.find((h) => h.undoable && /show changed/.test(h.text));
    check((await as.desk.call("POST", `/api/desk/changes/${showLine.id}/undo`)).status === 200, "the show change undone from History");
    check((await pool.query("SELECT status FROM rulebook_edits WHERE rulebook_id = $1 AND source = 'admin'", [rb])).rows[0].status === "withdrawn", "its edit withdrawn");
    const howJ2 = (await as.jordan.call("GET", `/api/seasons/${sid}/how-it-works${A}`)).body.how;
    check(!howJ2.updates.hidden, "and How it works has no update waiting", JSON.stringify(howJ2.updates));
    check((await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "save", kind: "show_changed", fromEpisode: 1, blocks: back })).status === 400, "a show change from the premiere is refused (that's a fix)");

    // Check for changes: research describes the show again, from this rulebook.
    await d.page.reload();
    await d.page.locator("[data-check-changes]").click();
    await d.page.locator("[data-check-sheet] [data-copy-prompt]:not([disabled])").waitFor({ timeout: 20000 });
    await d.page.locator("[data-copy-prompt]").click();
    await toasted(d.page, /copied/);
    const prompt = await d.page.evaluate(() => navigator.clipboard.readText());
    check(prompt.length > 1000 && prompt.includes("Reward challenge"), "the question starts from the rulebook as it is now");
    const now = (await as.desk.call("GET", `/api/desk/rulebooks/${rb}`)).body.now;
    const researched = { ...JSON.parse(JSON.stringify(now)), twists: [...now.twists, { id: "shotInTheDark", type: "advantage", name: "Shot in the Dark", oneIsCalled: "a Shot in the Dark", gotBy: "found", does: ["keepsSafe"], lasts: "oneUse" }] };
    await d.page.locator("[data-check-answer]").fill(`Here's the rulebook:\n\`\`\`json\n${JSON.stringify(researched)}\n\`\`\``);
    await d.page.locator("[data-review]").click();
    await d.page.locator("[data-review-result]").waitFor({ timeout: 20000 });
    const reviewed = await d.page.locator("[data-review-result]").innerText();
    check(/1 change/.test(reviewed) && reviewed.includes("Shot in the Dark"), "reviewed: 1 change, + New advantage: Shot in the Dark", reviewed);
    await fits(d.page, "Check for changes");
    await shot(d.page, "check-for-changes");
    await d.page.locator("[data-use-review]").click();
    await d.page.locator("[data-unsaved='1']").waitFor({ timeout: 10000 });
    check(true, "Use these changes: in the draft, unsaved");
    await d.page.locator("[data-discard]").click();
    await d.page.locator("[data-unsaved]").waitFor({ state: "detached" });

    // The suggestion, Lock, a starting point, and the leagues back on the show's rules.
    await d.page.locator("[data-suggestion-done]").click();
    await toasted(d.page, /Marked fixed/);
    check((await pool.query("SELECT status FROM rulebook_suggestions WHERE id = $1", [tip[0].id])).rows[0].status === "done", "jordan's suggestion marked fixed");
    await d.page.locator("[data-lock='off']").click();
    await d.page.locator("[data-lock='on']").waitFor({ timeout: 15000 });
    check(!!(await pool.query("SELECT locked_at FROM rulebooks WHERE id = $1", [rb])).rows[0].locked_at, "the rulebook locked");
    await d.page.locator("[data-lock='on']").click();
    await d.page.locator("[data-lock='off']").waitFor({ timeout: 15000 });
    const tpl = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "template" });
    const tplRow = (await pool.query("SELECT owner_kind, is_template, blocks FROM rulebooks WHERE id = $1", [tpl.body.id])).rows[0];
    check(tplRow?.owner_kind === "library" && tplRow.is_template && tplRow.blocks.segments.find((s) => s.id === "rewardChallenge").often === "someEpisodes", "Save as a starting point: a library copy with every fix in");
    await d.page.locator("[data-live='on']").click();
    await toasted(d.page, /went back to the show's rules/);
    check((await pool.query("SELECT count(*)::int AS n FROM leagues WHERE id = ANY($1::uuid[]) AND state->'settings' ? 'rulebook'", [zt.map((k) => L[k])])).rows[0].n === 0, "Leagues back on the show's rules");
    await fits(d.page, "the rulebook, at the end");
    await shot(d.page, "rulebook-end");

    // ---- 9. Settings ----
    await d.page.goto(`${d.BASE}/desk/settings`);
    await d.page.locator("[data-rulebooks-status]").waitFor({ timeout: 20000 });
    await fits(d.page, "Settings");
    await shot(d.page, "settings");
    await d.page.locator("[data-desk-row='confirm']").click();
    await d.page.locator("[data-confirm-at='3']").click();
    await toasted(d.page, /Sources to confirm a result: 3/);
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'confirm_at'")).rows[0]?.value === 3, "Confirmed needs 3 sources");
    await d.page.locator("[data-desk-row='couches']").click();
    await d.page.locator("[data-new-couches='false']").click();
    await toasted(d.page, /New couches/);
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'new_couch_fill'")).rows[0]?.value === false, "new couches: only people who run games");
    const set = (await as.desk.call("GET", "/api/desk/settings")).body;
    for (const l of set.history.filter((h) => h.undoable)) await as.desk.call("POST", `/api/desk/changes/${l.id}/undo`);
    const after = (await as.desk.call("GET", "/api/desk/settings")).body.settings;
    check(after.confirmAt === 2 && after.newCouchesAnyone === true, "both undone from History", JSON.stringify(after));

    // ---- 10. nothing real moved ----
    const realAfter = { leagues: (await pool.query(REAL_LEAGUES)).rows, results: (await pool.query(REAL_RESULTS)).rows[0].h };
    check(JSON.stringify(realAfter.leagues) === JSON.stringify(realBefore.leagues), "every real league's state is as it was");
    check(realAfter.results === realBefore.results, "every real season's results are as they were");

    for (const [who, b, list] of [["jordan", j, jFailed], ["desk", d, dFailed]]) {
      const errs = b.errors.filter((e) => !/Failed to load resource/.test(e));
      const bad = list.filter((x) => !/^(400|403|409) /.test(x));
      check(!errs.length && !bad.length, `no page errors (${who})`, [...errs, ...bad].join(" | "));
    }
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool);
    // The two site settings as they were (History's Undo leaves a row behind).
    for (const k of ["confirm_at", "new_couch_fill"]) {
      const was = settingsBefore.find((r) => r.key === k);
      if (was) await pool.query("UPDATE app_settings SET value = $2 WHERE key = $1", [k, JSON.stringify(was.value)]);
      else await pool.query("DELETE FROM app_settings WHERE key = $1", [k]);
    }
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
