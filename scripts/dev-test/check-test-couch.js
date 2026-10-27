// Dev-only check for a site admin's test couch (src/lib/server/test-couch.ts, /api/test-couch; docs/PLAN-researched-survivor.md),
// against the dev server, on new-fixture.js's couch ("ZT Survivor 51": alex runs its three linked games, riley is a Game admin in
// the lineup one, jordan and sam play) with alex made a site admin for the run (put back after).
//   API:
//   - only a site admin: riley gets 403; sources are alex's couches' seasons with games (ZT Survivor 51's three, ZT Extra's one);
//   - made from ZT Survivor 51: "Test · ZT Survivor 51", one test player per person in its games (alex's first, owning the couch,
//     running the games, then by name; riley's a Game admin; casey, only in ZT Extra, gets none), each named <username>_test in their account
//     and their seats, with no password (signing in as one fails); every game copied with its real one's id (shadowOf), the
//     same seats and roles, on one rulebook of the couch's own (Make it ours's shape); the season's results reach them (they're
//     on the season, as syncSeasonLeagues finds its games); on the template every table matches its real game's, episode by
//     episode;
//   - rules: fresh swaps the rulebook (new ids), same puts the real games' own back, researched asks our bot (fake-bot.js, a
//     fenced copy of the built-in blocks) after the answer and switches when it's in; back to the template;
//   - Copy again puts back what was changed in a test game; Remove takes the couch, its games, rulebook and test players.
//   In a real browser at --width (390 by default), as alex: Settings' Test couch section (made there: pick the couch, Make), the
//   profile menu's Test players; switching into riley_test (the Viewing as bar, his home on the test couch, Now on him), as him
//   refused what every game on the season shares (flagging a result) and changing the test couch (go back first), straight on
//   to jordan_test, then Back to me. Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-test-couch.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it, alex a site admin, for a look); touches zt rows only (the
// fixture's, and the test couch made from them: its players are zt_nd_*_test); refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const { BUILT_IN_BLOCKS } = require("../../src/lib/game/formats/blocks/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-test-couch runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-test-couch.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** The test couch alex made, gone (what Remove does), whatever the run got to. */
async function removeTestCouch(pool, ownerId) {
  const { rows } = await pool.query("SELECT couch_id FROM test_couches WHERE owner_id = $1", [ownerId]);
  for (const { couch_id } of rows) {
    const players = (await pool.query("SELECT user_id FROM test_players WHERE couch_id = $1", [couch_id])).rows.map((r) => r.user_id);
    const groups = (await pool.query("SELECT DISTINCT group_id FROM leagues WHERE couch_id = $1 AND group_id IS NOT NULL", [couch_id])).rows.map((r) => r.group_id);
    await pool.query("DELETE FROM leagues WHERE couch_id = $1", [couch_id]);
    if (groups.length) await pool.query("DELETE FROM league_groups WHERE id = ANY($1::uuid[])", [groups]);
    await pool.query("DELETE FROM couches WHERE id = $1", [couch_id]);
    await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [players]);
  }
}

/** Each player's total after every episode, by seat. */
function tables(state) {
  const out = [];
  const last = Math.max(0, ...state.episodes.filter((e) => S.resultsStage?.(e) || e.results).map((e) => e.number));
  for (let n = 1; n <= last; n++) {
    const view = S.SpoilerLogic.viewThrough(state, n);
    out.push(S.computeScores(view).map((r) => `${r.playerId}:${r.total}`).sort().join(","));
  }
  return out;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  let A = null;
  let bot = null;
  try {
    const fx = await fixture.up(pool);
    A = fx.users.alex;
    await removeTestCouch(pool, A);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [A]);
    const PASSWORD = fixture.PASSWORD;
    const alex = await api({ user: fixture.username("alex"), pass: PASSWORD });
    const riley = await api({ user: fixture.username("riley"), pass: PASSWORD });
    const real = [fx.leagues.outlast, fx.leagues.lineup, fx.leagues.pool];
    const sourceKey = `${fx.couchId}/${fx.seasonId}`;

    // ---------- who, and from where ----------
    check((await riley.call("GET", "/api/test-couch")).status === 403 && (await riley.call("POST", "/api/test-couch", { couchId: fx.couchId, seasonId: fx.seasonId })).status === 403, "riley (not a site admin): no test couch, refused making one");
    let t = (await alex.call("GET", "/api/test-couch")).body;
    const src = t.sources?.find((s) => s.couchId === fx.couchId);
    const extra = t.sources?.find((s) => s.couchId === fx.extraCouchId);
    check(t.couch === null && src?.games === 3 && src.seasonId === fx.seasonId && extra?.games === 1 && t.sources.length === 2, "alex: no test couch yet; his couches' seasons with games: ZT Survivor 51's three, ZT Extra's one", JSON.stringify(t.sources));
    check((await alex.call("POST", "/api/test-couch", { couchId: fx.couchId, seasonId: fx.traitorsSeasonId })).status === 400, "a season the couch has no games on: refused");

    // ---------- made in Settings ----------
    const B = await open({ user: fixture.username("alex"), pass: PASSWORD, width });
    closers.push(B.close);
    const page = B.page;
    const noWider = async (where) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(w <= width, `${where}: nothing wider than the screen`, `${w}px`);
    };
    await page.goto(BASE + "/settings");
    const section = page.locator("[data-settings-test-couch]");
    await section.waitFor({ timeout: 30000 });
    await section.scrollIntoViewIfNeeded();
    await section.locator(`[data-choice="${sourceKey}"]`).click();
    check((await section.locator('[data-choice="rules-template"]').getAttribute("aria-checked")) === "true", "Settings: the template is picked to start (Recommended)");
    await section.screenshot({ path: path.join(out, "settings-make.png") });
    await section.locator("[data-make-test-couch]").click();
    await page.locator("[data-test-couch]").waitFor({ timeout: 60000 });
    await page.locator("[data-test-couch]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, "settings-made.png") });
    await noWider("Settings with a test couch");

    t = (await alex.call("GET", "/api/test-couch")).body;
    const names = t.players.map((p) => `${p.name}/${p.standsFor}/${p.role}`);
    check(t.couch?.name === "Test · ZT Survivor 51" && t.couch.rules === "template" && t.couch.games.length === 3 && t.viewingAs === false, "made: Test · ZT Survivor 51, its three games, on the template", JSON.stringify(t.couch));
    check(
      names.join() === ["zt_nd_alex_test/zt_nd_alex/commissioner", "zt_nd_jordan_test/zt_nd_jordan/member", "zt_nd_riley_test/zt_nd_riley/admin", "zt_nd_sam_test/zt_nd_sam/member"].join(),
      "one test player per person in its games, alex's first and running them, then by name; riley's a Game admin, none for casey",
      names.join()
    );
    const couchId = t.couch.id;
    const tp = Object.fromEntries(t.players.map((p) => [p.standsFor.replace("zt_nd_", ""), p.userId]));
    const owner = (await pool.query("SELECT user_id FROM couch_members WHERE couch_id = $1 AND role = 'owner'", [couchId])).rows.map((r) => r.user_id);
    const onCouch = (await pool.query("SELECT user_id FROM couch_members WHERE couch_id = $1", [couchId])).rows.map((r) => r.user_id);
    check(owner.join() === tp.alex && onCouch.length === 4 && !onCouch.includes(A), "the couch is its test players' (alex's own owns it); the real alex isn't on it", JSON.stringify({ owner, n: onCouch.length }));
    const creds = (await pool.query(`SELECT count(*)::int AS n FROM account WHERE "userId" = ANY($1::text[])`, [Object.values(tp)])).rows[0].n;
    const signIn = await fetch(BASE + "/api/auth/sign-in/username", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: "zt_nd_riley_test", password: PASSWORD }) });
    check(creds === 0 && !signIn.ok, "test players have no password: signing in as one fails", `${creds} accounts, ${signIn.status}`);

    const { rows: copies } = await pool.query("SELECT id, name, state, rulebook_id, couch_id FROM leagues WHERE couch_id = $1 ORDER BY group_position", [couchId]);
    const { rows: reals } = await pool.query("SELECT id, name, state FROM leagues WHERE id = ANY($1::uuid[])", [real]);
    const realOf = (c) => reals.find((r) => r.id === c.state.settings.shadowOf);
    const rb = copies[0]?.rulebook_id;
    const rbRow = (await pool.query("SELECT owner_kind, status, reader, provenance FROM rulebooks WHERE id = $1", [rb])).rows[0];
    check(copies.length === 3 && copies.every((c) => realOf(c) && c.name === realOf(c).name && c.rulebook_id === rb), "each test game is a real one's copy (shadowOf, its name), all on one rulebook", copies.map((c) => c.name).join());
    check(rbRow?.owner_kind === "league" && rbRow.status === "in_force" && rbRow.reader === "research" && [true, "true"].includes(rbRow.provenance.ours) && [true, "true"].includes(rbRow.provenance.test), "the rulebook is the couch's own (Make it ours's shape), read as research", JSON.stringify(rbRow));
    check(copies.every((c) => c.state.settings.rulebook?.id === rb && c.state.settings.rulebook.reader === "research"), "every test game plays by it (settings.rulebook)");
    const seatOk = [];
    for (const c of copies) {
      const r = realOf(c);
      const { rows: rm } = await pool.query("SELECT user_id, player_id, role FROM league_memberships WHERE league_id = $1", [r.id]);
      const { rows: cm } = await pool.query("SELECT user_id, player_id, role FROM league_memberships WHERE league_id = $1", [c.id]);
      const who = Object.fromEntries(Object.entries(fx.users).map(([k, v]) => [v, k]));
      const want = rm.map((m) => `${tp[who[m.user_id]]}:${m.player_id}:${m.user_id === A && m.role === "member" ? "admin" : m.role}`).sort().join();
      const got = cm.map((m) => `${m.user_id}:${m.player_id}:${m.role}`).sort().join();
      const seats = c.state.players.map((p) => p.name).sort().join();
      const wantSeats = cm.map((m) => `zt_nd_${Object.entries(tp).find(([, v]) => v === m.user_id)[0]}_test`).sort().join();
      seatOk.push(want === got && seats === wantSeats);
    }
    check(seatOk.every(Boolean), "the same seats and roles, each seat named for its test player", JSON.stringify(seatOk));
    const same = copies.every((c) => JSON.stringify(tables(c.state)) === JSON.stringify(tables(realOf(c).state)));
    check(same && tables(copies[1].state).length >= 5, "on the template every table matches its real game's, episode by episode", copies.map((c) => tables(c.state).slice(-1)[0]).join(" | "));
    // syncSeasonLeagues's own query: the games results reach.
    const { rows: synced } = await pool.query(
      `SELECT l.id FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE ss.id = $1 AND l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''`,
      [fx.seasonId]
    );
    check(copies.every((c) => synced.some((s) => s.id === c.id)), "the season's results reach the test games (they're on its season)");

    // ---------- the switches ----------
    const profile = async () => {
      await page.goto(BASE + "/home");
      await page.getByRole("button", { name: "Your profile" }).click();
      await page.locator("[data-test-switches]").waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
    };
    // A switch reloads the page (often /home on /home): wait for that load, then for the bar to name who you are.
    const switchVia = async (selector, who) => {
      await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.locator(selector).click()]);
      if (who) await page.waitForFunction((w) => new RegExp(`Viewing as\\s*${w}`).test(document.body.innerText), who, { timeout: 20000 });
      else await page.waitForTimeout(1500);
    };
    await profile();
    check((await page.locator("[data-test-player]").count()) === 4 && (await page.locator("[data-test-back]").count()) === 0, "your profile: the four test players, no Back to me (you're you)");
    await page.screenshot({ path: path.join(out, "profile-switches.png") });
    await noWider("the profile menu");
    await switchVia('[data-test-player="zt_nd_riley_test"]', "zt_nd_riley_test");
    const bar = await page.getByText("Viewing as", { exact: false }).first().innerText();
    const home = await page.evaluate(() => fetch("/api/me/home").then((r) => r.json()));
    check(/zt_nd_riley_test/.test(bar) && home.couches?.length === 1 && home.couches[0].id === couchId, "Switch: viewing as zt_nd_riley_test, his home on the test couch", `${bar} · ${home.couches?.map((c) => c.name)}`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, "as-riley-home.png") });
    // The refusals asked on purpose below: the browser logs each as a failed load, which isn't a page error.
    const asked = B.errors.length;
    const flag = await page.evaluate(
      ([sid, cid]) => fetch(`/api/seasons/${sid}/disputes?couch=${cid}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ episode: 1, reason: "wrong" }) }).then(async (r) => ({ status: r.status, body: await r.json() })),
      [fx.seasonId, couchId]
    );
    check(flag.status === 403 && /Test players/.test(flag.body.error), "as him: flagging a result (shared by every game on the season) refused", JSON.stringify(flag));
    const asHim = await page.evaluate(() => fetch("/api/test-couch").then((r) => r.json()));
    const change = await page.evaluate(() => fetch("/api/test-couch", { method: "DELETE" }).then((r) => r.status));
    B.errors.splice(asked, B.errors.slice(asked).filter((e) => /status of (403|409)/.test(e)).length);
    check(asHim.viewingAs === true && asHim.players.find((p) => p.current)?.name === "zt_nd_riley_test" && change === 409, "as him: the switches (Now on him), changing the test couch refused (go back first)", JSON.stringify({ change, current: asHim.players?.find((p) => p.current) }));
    await profile();
    check((await page.locator('[data-test-player="zt_nd_riley_test"][aria-current]').count()) === 1 && (await page.locator("[data-test-back]").count()) === 1, "his profile: Now on him, and Back to me");
    await page.screenshot({ path: path.join(out, "profile-as-riley.png") });
    await switchVia('[data-test-player="zt_nd_jordan_test"]', "zt_nd_jordan_test");
    const asJordan = await page.evaluate(() => fetch("/api/me").then((r) => r.json()));
    check(asJordan.user?.username === "zt_nd_jordan_test" && asJordan.impersonating === true, "straight on to zt_nd_jordan_test, no stop at you", JSON.stringify(asJordan.user));
    await profile();
    await switchVia("[data-test-back]", null);
    const me = await page.evaluate(() => fetch("/api/me").then((r) => r.json()));
    check((await page.getByText("Viewing as", { exact: false }).count()) === 0 && me.user?.username === "zt_nd_alex" && me.impersonating === false, "Back to me: alex again, no Viewing as bar", JSON.stringify(me).slice(0, 160));

    // ---------- rules ----------
    const ruleOf = async () => (await pool.query("SELECT state->'settings'->'rulebook' AS rb, rulebook_id FROM leagues WHERE couch_id = $1 ORDER BY group_position", [couchId])).rows;
    let r = await alex.call("PATCH", "/api/test-couch", { rules: "fresh" });
    let rbs = await ruleOf();
    const freshIds = Object.keys(rbs[1].rb?.data?.scoringEvents ?? rbs[1].rb?.data?.events ?? {});
    check(r.status === 200 && r.body.couch.rules === "fresh" && rbs.every((x) => x.rb?.id && x.rb.id !== rb && x.rulebook_id === x.rb.id), "Fresh ids: a new rulebook for every test game", JSON.stringify({ status: r.status, ids: freshIds.length }));
    r = await alex.call("PATCH", "/api/test-couch", { rules: "same" });
    rbs = await ruleOf();
    const realRb = reals.map((x) => JSON.stringify(x.state.settings.rulebook ?? null));
    check(r.body.couch?.rules === "same" && rbs.every((x, i) => JSON.stringify(x.rb ?? null) === JSON.stringify(realOf(copies[i]).state.settings.rulebook ?? null) && x.rulebook_id === null), "The real games' own: each plays by what its real game does", realRb.join(" | ").slice(0, 120));
    bot = await require("./fake-bot").start({ answer: () => "```json\n" + JSON.stringify({ ...JSON.parse(JSON.stringify(BUILT_IN_BLOCKS.survivor.blocks)), show: "ZT Survivor" }, null, 1) + "\n```", delayMs: 1500 });
    const alexBot = await api({ user: fixture.username("alex"), pass: PASSWORD, headers: { "x-gys-bot": bot.url } });
    r = await alexBot.call("PATCH", "/api/test-couch", { rules: "researched" });
    check(r.status === 200 && r.body.couch.researching === true && r.body.couch.rules === "same", "Researched: our bot asked after the answer (still on what it had)", JSON.stringify(r.body.couch ?? r.body).slice(0, 200));
    let done = null;
    for (let i = 0; i < 40 && !done; i++) {
      await new Promise((res) => setTimeout(res, 500));
      const g = (await alex.call("GET", "/api/test-couch")).body;
      if (!g.couch.researching) done = g;
    }
    rbs = await ruleOf();
    check(done?.couch.rules === "researched" && !done.couch.message && rbs.every((x) => x.rb?.reader === "research" && x.rulebook_id === x.rb.id) && bot.asked.length === 1, "…and its rules in: every test game on them", JSON.stringify({ couch: done?.couch, asked: bot.asked.length }).slice(0, 240));
    const kept = (await pool.query("SELECT rules_answer IS NOT NULL AS kept FROM test_couches WHERE couch_id = $1", [couchId])).rows[0].kept;
    r = await alexBot.call("PATCH", "/api/test-couch", { rules: "template" });
    await alexBot.call("PATCH", "/api/test-couch", { rules: "researched" });
    check(kept && bot.asked.length === 1 && (await alex.call("GET", "/api/test-couch")).body.couch.rules === "researched", "back to researched again: its answer kept, no new ask");
    await alex.call("PATCH", "/api/test-couch", { rules: "template" });
    check((await ruleOf()).every((x) => x.rb?.reader === "research") && (await alex.call("GET", "/api/test-couch")).body.couch.rules === "template", "and back on the template");

    // ---------- copy again, remove ----------
    await pool.query(`UPDATE leagues SET state = jsonb_set(state, '{players,0,name}', '"zt changed"') WHERE id = $1`, [copies[0].id]);
    r = await alex.call("PATCH", "/api/test-couch", { copy: true });
    const back = (await pool.query("SELECT state FROM leagues WHERE id = $1", [copies[0].id])).rows[0].state;
    const ids = (await pool.query("SELECT id FROM leagues WHERE couch_id = $1", [couchId])).rows.map((x) => x.id).sort();
    check(r.status === 200 && !back.players.some((p) => p.name === "zt changed") && ids.join() === copies.map((c) => c.id).sort().join() && r.body.couch.rules === "template", "Copy again: what was changed in a test game put back, the same games, the same rules");
    await page.goto(BASE + "/settings");
    await page.locator("[data-test-couch]").waitFor({ timeout: 20000 });
    await page.locator("[data-settings-test-couch]").getByText("Remove the test couch").click();
    const hold = page.locator("[data-hold]:not([disabled])");
    await hold.waitFor();
    await page.screenshot({ path: path.join(out, "remove-sheet.png") });
    const box = await hold.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1800);
    await page.mouse.up();
    await page.locator("[data-make-test-couch]").waitFor({ timeout: 20000 });
    const left = (await pool.query(
      `SELECT (SELECT count(*) FROM couches WHERE id = $1)::int AS couch, (SELECT count(*) FROM leagues WHERE couch_id = $1)::int AS games,
              (SELECT count(*) FROM rulebooks WHERE id = $2)::int AS rulebook, (SELECT count(*) FROM "user" WHERE id = ANY($3::text[]))::int AS players,
              (SELECT count(*) FROM leagues WHERE id = ANY($4::uuid[]))::int AS real`,
      [couchId, rb, Object.values(tp), real]
    )).rows[0];
    check(left.couch === 0 && left.games === 0 && left.rulebook === 0 && left.players === 0 && left.real === 3, "Remove (held): the couch, its games, rulebook and test players gone; the real games untouched", JSON.stringify(left));
    check(B.errors.length === 0, "no page errors", B.errors.slice(0, 3).join(" | "));
  } catch (e) {
    console.log("FAIL  " + (e.stack || e));
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (bot) await bot.close().catch(() => {});
    if (!keep) {
      if (A) await pool.query(`UPDATE "user" SET role = 'user' WHERE id = $1`, [A]).catch(() => {});
      if (A) await removeTestCouch(pool, A).catch(() => {});
      await fixture.down(pool).catch((e) => console.log("down failed: " + e.message));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
