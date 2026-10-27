// Dev-only check for computer players in anyone's games (src/lib/game/computer-players.ts, src/lib/server/computer-players.ts;
// 2026-10-27), against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51's three linked
// games, alex running them, riley a Game admin in the lineup game).
//   API:
//   - Start a game offers computer players on a competition's drafts and Survival Pool; jordan starts Outlast with two Sharp
//     ones (named after nobody there, into the draft order, a line in Recent changes); refusals: six, or a level that isn't one;
//   - Backstage › Members: jordan's game lists its computer players; jordan adds an Easy one and makes it Normal; riley, who
//     doesn't run it, is refused; riley as the lineup game's Game admin adds one there (and takes it out);
//   - the draft: once it's open no one joins or leaves; the bots draft as their turns come; once it's done jordan takes them
//     all out: their teams are free again and the draft stays done;
//   - the practice couch is open to someone on a couch (alex), not only someone solo.
//   In a real browser at --width (390 by default), as jordan: the Games tab's Practice card, Start a game's Computer players
//   (how many, then how sharp), Backstage › Members' Computer players with a bot's sheet. Nothing wider than the screen; no
//   page errors. Screenshots in <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-computer-players.js <outDir> [--width=390] [--keep] [--api]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; its down removes the games zt_nd people started, practice
// couches too); touches zt rows only; refuses a non-local database. Shares the zt_nd_ fixture: never run it alongside another
// check that uses it. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-computer-players runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-computer-players.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const sid = fx.seasonId;
    const q = `?couch=${fx.couchId}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const state = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const botsOf = (s) => s.players.filter((p) => p.automated && !p.disabled);
    const bots = (who, body) => as[who].call("POST", `/api/seasons/${sid}/backstage/computer${q}`, body);
    const members = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/backstage/members${q}`)).body;

    // ---------- Start a game ----------
    const opts = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    const offered = opts.games.filter((g) => g.fits && g.bots).map((g) => g.key).sort().join();
    check(offered === "outlast,survivalPool,weeklyLineup", "Start a game offers computer players on a competition's drafts and Survival Pool", offered);
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "outlast", tell: false, bots: 6 });
    check(r.status === 400, "six computer players are refused", `${r.status}`);
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "outlast", tell: false, bots: 2, level: "sharp" });
    check(r.status === 200, "jordan starts Outlast with two Sharp computer players", JSON.stringify(r.body));
    const game = r.body.leagueId;
    let s = await state(game);
    const names = botsOf(s).map((p) => p.name);
    check(
      names.length === 2 && botsOf(s).every((p) => p.botLevel === "sharp") && new Set(s.players.map((p) => p.name.toLowerCase())).size === s.players.length,
      "two Sharp computer players, named after nobody there",
      JSON.stringify(s.players.map((p) => [p.name, p.automated, p.botLevel]))
    );
    check(s.draftOrder.length === 3, "all three in the draft order", JSON.stringify(s.draftOrder));
    const lines = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines;
    check(lines.some((l) => /started Outlast with 2 computer players/.test(l.text)), "Recent changes says so", JSON.stringify(lines.map((l) => l.text).slice(0, 3)));

    // ---------- Backstage › Members ----------
    let m = await members("jordan");
    let g = m.games.find((x) => x.leagueId === game);
    check(g?.computer?.bots.length === 2 && g.computer.add === null && g.computer.remove === null, "Members lists jordan's game's computer players", JSON.stringify(g?.computer));
    check(m.games.filter((x) => x.leagueId !== game).every((x) => x.computer === null), "and none for the games jordan only plays");
    r = await bots("jordan", { leagueId: game, action: "add", level: "easy" });
    s = await state(game);
    const added = botsOf(s).find((p) => p.name === r.body.names?.[0]);
    check(r.status === 200 && added?.botLevel === "casual" && botsOf(s).length === 3, "jordan adds an Easy one", JSON.stringify(r.body));
    r = await bots("jordan", { leagueId: game, action: "level", playerId: added?.id, level: "normal" });
    check(r.status === 200 && botsOf(await state(game)).find((p) => p.id === added?.id)?.botLevel === "solid", "and makes it Normal");
    r = await bots("jordan", { leagueId: game, action: "level", playerId: added?.id, level: "genius" });
    check(r.status === 400, "a level that isn't one is refused", `${r.status}`);
    r = await bots("riley", { leagueId: game, action: "add", level: "easy" });
    check(r.status === 403, "riley, who doesn't run it, can't add one", `${r.status}`);
    // A Game admin runs a game too: riley in the lineup game.
    const lineup = fx.leagues.lineup;
    const lineupBots = (await members("riley")).games.find((x) => x.leagueId === lineup)?.computer;
    check(!!lineupBots, "riley sees the lineup game's computer players as its Game admin", JSON.stringify(lineupBots));
    if (lineupBots?.add === null) {
      r = await bots("riley", { leagueId: lineup, action: "add", level: "normal" });
      check(r.status === 200, "riley adds one to the lineup game", JSON.stringify(r.body));
      r = await bots("riley", { leagueId: lineup, action: "remove", all: true });
      check(r.status === 200 && botsOf(await state(lineup)).length === 0, "and takes it out again");
    } else check(/draft has started/.test(lineupBots?.add ?? ""), "the lineup game is drafted already: no joining", lineupBots?.add);

    // ---------- the draft ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/draft`, { leagueId: game, action: "start" });
    check(r.status === 200, "jordan opens the draft", JSON.stringify(r.body));
    r = await bots("jordan", { leagueId: game, action: "remove", playerId: added?.id });
    check(r.status === 409 && /draft's open/.test(r.body.error), "nobody leaves while the draft's open", JSON.stringify(r.body));
    r = await bots("jordan", { leagueId: game, action: "add", level: "easy" });
    check(r.status === 409 && /draft has started/.test(r.body.error), "and nobody joins", JSON.stringify(r.body));
    m = await members("jordan");
    g = m.games.find((x) => x.leagueId === game);
    check(!!g.computer.remove && !!g.computer.add, "Members says why, for the screen", JSON.stringify(g.computer));
    const me = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game, fx.users.jordan])).rows[0].player_id;
    for (let i = 0; i < 20; i++) {
      s = await state(game);
      const free = s.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      if (!free) break;
      const turn = (await as.jordan.call("GET", `/api/seasons/${sid}/draft${q}`)).body.games.find((x) => x.leagueId === game);
      if (!turn || turn.phase === "done") break;
      if (turn.clock?.playerId !== me) throw new Error(`the bots didn't take their turn: ${JSON.stringify(turn.clock)}`);
      r = await as.jordan.call("POST", `/api/seasons/${sid}/draft`, { leagueId: game, action: "pick", castawayId: free.id });
      if (r.status !== 200) throw new Error(`pick: ${r.status} ${JSON.stringify(r.body)}`);
    }
    s = await state(game);
    const done = (await as.jordan.call("GET", `/api/seasons/${sid}/draft${q}`)).body.games.find((x) => x.leagueId === game);
    const theirs = s.castaways.filter((c) => (c.ownerIds || []).some((id) => botsOf(s).some((b) => b.id === id))).map((c) => c.id);
    check(done?.phase === "done" && theirs.length === 3 * s.settings.teamSize, "the draft's done, the bots drafting their turns", `${done?.phase} ${theirs.length}`);
    check(done?.seats.filter((x) => x.bot).length === 3, "the draft room knows which seats are computers");

    // ---------- taking them out once it's done ----------
    r = await bots("jordan", { leagueId: game, action: "remove", all: true });
    s = await state(game);
    check(r.status === 200 && r.body.names.length === 3 && botsOf(s).length === 0, "once it's done, jordan takes them all out", JSON.stringify(r.body));
    check(theirs.every((id) => !(s.castaways.find((c) => c.id === id).ownerIds || []).length), "whoever they drafted is free again");
    const after = (await as.jordan.call("GET", `/api/seasons/${sid}/draft${q}`)).body.games.find((x) => x.leagueId === game);
    check(after?.phase === "done", "and the draft stays done", after?.phase);
    const outLine = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines.find((l) => /Took out the computer players/.test(l.text));
    check(outLine?.tier === 3, "a tier 3 line in Recent changes", JSON.stringify(outLine));
    r = await bots("jordan", { leagueId: game, action: "remove", all: true });
    check(r.status === 404, "nothing left to take out", `${r.status}`);

    // ---------- practice for someone on a couch ----------
    const pr = (await as.alex.call("GET", `/api/seasons/${sid}/practice`)).body;
    check(pr.blocked === null, "alex, on a couch, can start a practice couch", JSON.stringify(pr));

    // ---------- the browser ----------
    if (!apiOnly) {
      // A fresh game with computer players, before its draft, for Backstage.
      r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false, bots: 1 });
      check(r.status === 200, "jordan starts Survival Pool with a computer player", JSON.stringify(r.body));
      const b = await open({ user: "zt_nd_jordan", pass: fixture.PASSWORD, width, height: 844 });
      closers.push(b.close);
      const { page, errors } = b;
      let n = 0;
      const shot = async (name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      const wide = async (what) => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };

      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-couch-practice]").waitFor({ timeout: 15000 }).catch(() => {});
      check((await page.locator("[data-couch-practice] [data-practice]").count()) === 1, "the Games tab offers jordan a practice couch");
      await page.locator("[data-couch-practice]").scrollIntoViewIfNeeded().catch(() => {});
      await shot("games-practice");
      await wide("the Games tab");

      await page.locator('[data-start-row="start"]').click();
      await page.locator("[data-start-bots]").waitFor({ timeout: 10000 }).catch(() => {});
      check((await page.locator("[data-start-bots]").count()) === 1, "Start a game: Computer players, for a competition's game");
      check((await page.locator("[data-start-bots-level]").count()) === 0, "how sharp only once there are some");
      await page.locator('[data-start-bots-count="2"]').click();
      check((await page.locator("[data-start-bots-level]").count()) === 3 && (await page.locator('[data-start-bots-level="normal"]').getAttribute("aria-checked")) === "true", "two: Easy, Normal (picked), Sharp");
      await page.locator("[data-start-bots]").scrollIntoViewIfNeeded();
      await b.settle();
      await shot("start-bots");
      await wide("Start a game");
      await page.keyboard.press("Escape");

      await page.goto(`${BASE}/show/${sid}/backstage/members`, { waitUntil: "load" });
      await page.locator("[data-computer-players]").waitFor({ timeout: 15000 }).catch(() => {});
      check((await page.locator("[data-computer-players] [data-bot]").count()) === 1, "Backstage › Members: the pool's computer player");
      check((await page.locator("[data-bot-add]").count()) >= 1, "Add a computer player");
      await page.locator("[data-computer-players]").scrollIntoViewIfNeeded();
      await shot("members-bots");
      await wide("Members");
      await page.locator("[data-bot-menu]").first().click();
      await page.locator("[data-bot-sheet]").waitFor();
      await b.settle();
      await shot("bot-sheet");
      await page.locator('[data-bot-level="sharp"]').click();
      await page.locator("[data-bot-sheet]").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      const pool2 = r.body.leagueId;
      check(botsOf(await state(pool2))[0]?.botLevel === "sharp", "its sheet makes it Sharp");
      await page.locator("[data-bot-add]").first().click();
      await page.locator("[data-bot-add-sheet]").waitFor();
      await page.locator("[data-bot-add-go]").click();
      await page.locator("[data-bot-add-sheet]").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      check(botsOf(await state(pool2)).length === 2, "Add it: a second one joins");
      check((await page.locator('[data-bots-game="Outlast"]').count()) === 0, "a drafted game with none, that can't take one, isn't listed");
      await page.locator("[data-bots-out]").first().click();
      await page.locator('[data-guard="3"]').waitFor();
      await b.settle();
      const hold = await page.locator('[data-guard="3"]').innerText();
      check(/Both computer players leave Survival Pool and their picks with them/.test(hold) && !/Restorable/.test(hold), "the hold says what happens to a pool's, and promises no restore", hold);
      await shot("take-out-hold");
      const btn = page.locator("[data-hold]");
      const box = await btn.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1800);
      await page.mouse.up();
      await page.locator('[data-guard="3"]').waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      check(botsOf(await state(pool2)).length === 0, "held: they're out");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
