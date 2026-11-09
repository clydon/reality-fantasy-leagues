// Dev-only check for Start a game, the wizard (docs/PLAN-start-a-game-gpt.md U1; src/new/couch/start-wizard.tsx, the logic in
// src/lib/game/start-wizard/, the server's src/lib/server/start-spec.ts), against the dev server, on new-fixture.js's couch (alex,
// riley, jordan, sam on ZT Survivor 51's three linked games; results through Episode 5; Episode 6 three days out) with the stand-in
// bot (fake-bot.js, by the x-gys-bot header): no real bot is asked.
//   API:
//   - the wizard's page (GET /start?wizard=1): the ctx and pack the sheet rolls on, the couch's 4, the cast as alex has seen it
//     (no exit past alex's mark), asks left, who Start it tells (the three who play there);
//   - Start from a spec: a game the wizard's logic builds (a season's Weekly Lineup made more competitive, a captain) checked again
//     and made, alex its Commissioner, linked into the couch's group, its spec as built, a line in Recent changes; the couch told
//     only after the 10-second hold; Undo inside the hold takes it back (deleted, restorable) and nobody hears; Undo too late, or
//     someone else's, is refused; refusals (a start the listing doesn't have, a spec our check refuses, computer players on a game
//     of questions, a game in stages, someone not on the couch);
//   - Creative moments: a change to the game the sheet holds (no ask before it) with the button's words, the bot asked once for
//     the change and once for all three moments' ratings (momentsPrompt), offers back; one added to the season, the page read
//     again lists it, and a game built with it scores it.
//   In a real browser at --width (390 by default): the Games tab's Start a game opens the wizard (Tonight by default mid-season,
//   the readout, the rail, the game card, Start it the one yellow, nothing wider than the screen); one tap starts tonight's game
//   with an Undo that takes it back; the season's game changed by quick changes (Your version, the step outlined), a step's
//   screen, a twist, a bet, What scores, How it plays, Every game; Custom's episodes picked like dates; Surprise me and its keeps;
//   Describe a new game (the wait, the result, Change it in the sheet, Start it), Keep going and the See it toast; the errors
//   (our AI away, today's 10, no game in the words); Creative moments through to a moment added; Make it a game chained in (a
//   ready show's ?page=make&then=start hands off to the wizard). No page errors.
//
//   npm run dev  (or node scripts/lane.js dev; in another terminal)
//   node scripts/dev-test/check-start-a-game.js <outDir> [--width=390] [--keep] [--api | --browser]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Screenshots go to <outDir>. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeBot = require("./fake-bot");
const B = require("../../tests/fixtures/game-words/bank.js");
const W = require("../../src/lib/game/start-wizard/index.js");
const G = require("../../src/lib/game/game-spec/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-start-a-game runs against a local database only");
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-start-a-game.js <outDir> [--width=390] [--keep] [--api | --browser]");
fs.mkdirSync(out, { recursive: true });
const WIDTH = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const KEEP = args.includes("--keep");
const ONLY = args.includes("--api") ? "api" : args.includes("--browser") ? "browser" : null;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The wizard's input from GET ?wizard=1, as the sheet makes it. */
function inputOf(o) {
  const starts = new Map((o.wizard.page.pack.phases || []).map((p) => [p.id, p.starts ?? null]));
  return {
    page: o.wizard.page,
    first: o.from,
    last: o.wizard.last,
    listed: o.starts.map((e) => e.number),
    phases: (o.wizard.page.ctx.phases || []).map((p) => ({ id: p.id, name: p.name || p.id, starts: starts.get(p.id) ?? null })),
    part: o.part,
    label: o.label,
  };
}

// The stand-in's answers: the bank's g01 for its words; Creative moments' change, three new moments; their ratings, one ask.
const g01 = () => B.cases().find((c) => c.id === "g01");
const CREATIVE = ["Cried at camp", "Caught a fish", "Blindsided by a vote flip"];
function answers(prompt, kind) {
  if (kind === "momentsAsk")
    return JSON.stringify(
      CREATIVE.map((label, i) => ({ reliable: i === 1 ? "low" : "medium", why: `Recaps ${i === 1 ? "rarely" : "usually"} say who ${label.toLowerCase()}.`, about: "person", question: `This episode, who ${label.toLowerCase()}?`, label, nearest: [] }))
    );
  if (kind === "momentAsk") return JSON.stringify({ reliable: "medium", why: "Recaps usually say.", about: "person", question: "This episode, who cried?", label: "Cried", nearest: [] });
  if (kind === "gameChange") {
    const spec = JSON.parse((prompt.split("THE GAME SO FAR (a spec):\n")[1] || "{}").split("\n")[0]);
    return JSON.stringify({ game: spec, said: [], assumed: [], ask: [], cantYet: CREATIVE.map((what) => ({ what, why: "The show's research doesn't answer it yet", nearest: null, newMoment: what })), summary: "Three new moments" });
  }
  const at = prompt.indexOf("THEIR WORDS");
  const m = at >= 0 ? prompt.slice(at).match(/"""\n([\s\S]*?)\n"""/) : null;
  const words = m ? m[1] : "";
  const c = B.cases().find((x) => x.words === words);
  return c ? B.answerOf(c) : '{"game":null,"said":[],"assumed":[],"ask":[],"cantYet":[],"summary":"nothing"}';
}

async function apiHalf(pool, fx, bot) {
  const headers = { "x-gys-bot": bot.url };
  const alex = await signIn({ user: "zt_nd_alex", pass: fixture.PASSWORD, headers });
  const couch = fx.couchId;
  const sid = fx.seasonId;
  const url = `/api/seasons/${sid}/start?couch=${couch}`;

  const r0 = await alex.call("GET", `${url}&wizard=1`);
  const o = r0.body;
  check(r0.status === 200 && o.wizard && o.wizard.page.ctx && o.wizard.page.pack, "the wizard's page: the ctx and pack the sheet rolls on", JSON.stringify(r0.body).slice(0, 300));
  const pack = o.wizard.page.pack;
  check(pack.couch && pack.couch.people === 4, `...the couch's 4 (${pack.couch && pack.couch.people})`);
  check(pack.cast.length > 0 && pack.cast.every((c) => !c.out || c.out.episode <= 5), "...the cast as alex has seen it (no exit past Episode 5)");
  check(o.wizard.asksLeft === 10 && o.wizard.tells === 3 && o.from === 6, `...asks left ${o.wizard.asksLeft}, Start it tells ${o.wizard.tells}, from Episode ${o.from}`);

  // The wizard's logic on that page, as the phone runs it.
  const input = inputOf(o);
  const t = W.timing(input);
  check(t.mode === "tonight" && t.tonight.from === 6 && t.tonight.to === 6, `mid-season, Tonight by default (${t.mode}: ${W.sayRange(t[t.mode], input)})`);
  const wz = W.createWizard(input);
  const g = wz.games(t.season);
  check(g.list.length >= 6 && g.list[0].role === "The classic", `the rail for the rest of the season: ${g.list.map((x) => x.name).join(", ")}`);
  let choice = { ...W.fresh(), sel: g.list[0].id };
  const q = wz.applyQuick(t.season, choice, "comp");
  check(q.choice && q.toast, `More competitive: ${q.toast}`, JSON.stringify(q));
  choice = q.choice || choice;
  const built = wz.build(t.season, choice);
  check(built && built.r.ok, `built: ${built && built.r.describe && built.r.describe.short.line}`, built && built.r.why);

  // Start from a spec.
  const before = Date.now();
  const st = await alex.call("POST", url, { spec: built.r.spec, name: wz.nameOf(t.season, choice), tell: true, made: { how: "standard" } });
  check(st.status === 200 && st.body.leagueId && st.body.holdMs === 10000 && st.body.told === 3, "Start it: made, the couch told after a 10-second hold", JSON.stringify(st.body).slice(0, 300));
  const lid = st.body.leagueId;
  const { rows: made } = await pool.query("SELECT l.name, l.group_id, l.state, m.role FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.user_id = $2 WHERE l.id = $1", [lid, fx.users.alex]);
  check(made[0] && made[0].role === "commissioner" && made[0].group_id, "...alex its Commissioner, linked into the couch's group");
  const kept = made[0] ? G.specOf(made[0].state.settings) : null;
  check(kept && kept.score && kept.score.captain && kept.get.each === built.r.spec.get.each, "...its spec as built (the team's size, the captain)", JSON.stringify(kept && { get: kept.get, score: kept.score }).slice(0, 300));
  const { rows: ch } = await pool.query("SELECT text FROM league_changes WHERE league_id = $1 AND kind = 'game.start'", [lid]).catch(() => ({ rows: [] }));
  check(ch.length === 1 && /zt_nd_alex started/.test(ch[0].text), `...a line in Recent changes: "${ch[0] && ch[0].text}"`);
  const told = async (leagueId) => (await pool.query("SELECT count(*)::int AS n FROM notifications WHERE key = $1", [`started:${leagueId}`])).rows[0].n;
  check((await told(lid)) === 0, "...nobody's told inside the hold");

  // Undo inside the hold, on a second game.
  const g2 = wz.games(t.tonight).list[0];
  const st2 = await alex.call("POST", url, { spec: g2.spec, name: g2.name, tell: true });
  check(st2.status === 200, "a second game (tonight's)", JSON.stringify(st2.body).slice(0, 200));
  const riley = await signIn({ user: "zt_nd_riley", pass: fixture.PASSWORD, headers });
  const theirs = await riley.call("POST", url, { undo: st2.body.leagueId });
  check(theirs.status === 404, `someone else can't take it back (${theirs.status})`);
  const undo = await alex.call("POST", url, { undo: st2.body.leagueId });
  const { rows: gone } = await pool.query("SELECT deleted_at FROM leagues WHERE id = $1", [st2.body.leagueId]);
  check(undo.status === 200 && gone[0] && gone[0].deleted_at, "Undo inside the hold takes it back (deleted, restorable)", JSON.stringify(undo.body));
  await sleep(Math.max(0, before + 12000 - Date.now()));
  check((await told(lid)) === 3, `after the hold, the three who play there hear (${await told(lid)})`);
  check((await told(st2.body.leagueId)) === 0, "...and nobody hears about the one taken back");
  await pool.query("UPDATE leagues SET created_at = now() - interval '2 minutes' WHERE id = $1", [lid]);
  const late = await alex.call("POST", url, { undo: lid });
  check(late.status === 409, `Undo too late is refused (${late.status}: ${late.body && late.body.error})`);

  // Refusals.
  const aired = await alex.call("POST", url, { spec: { ...built.r.spec, span: { from: 4, to: null } }, tell: false });
  check(aired.status === 400, `a start the listing doesn't have (${aired.status}: ${aired.body && aired.body.error})`);
  const bad = await alex.call("POST", url, { spec: { ...built.r.spec, get: { by: "draft", each: 99, own: "exclusive" } }, tell: false });
  check(bad.status === 409, `a spec our check refuses (${bad.status}: ${bad.body && bad.body.error})`);
  const qs = wz.games(t.season).list.find((x) => x.id === "predictions");
  const bots = await alex.call("POST", url, { spec: qs.spec, tell: false, bots: 2 });
  check(bots.status === 409, `computer players on a game of questions (${bots.status}: ${bots.body && bots.body.error})`);
  const staged = G.rollSpec(o.wizard.page, { length: t.season, base: "lineup", twists: ["redraft"] }, "zt-stages");
  if (staged.ok) {
    const st3 = await alex.call("POST", url, { spec: staged.spec, tell: false });
    check(st3.status === 409, `a game in stages isn't made here yet (${st3.status})`);
  }
  const casey = await signIn({ user: "zt_nd_casey", pass: fixture.PASSWORD, headers });
  const off = await casey.call("POST", url, { spec: built.r.spec, tell: false });
  check(off.status === 403 || off.status === 404, `someone not on the couch (${off.status})`);

  // Creative moments: a change to the game the sheet holds, with the button's words.
  const wordsUrl = `/api/seasons/${sid}/game-words`;
  const cm = await alex.call("POST", wordsUrl, { couch, change: { spec: built.r.spec, game: "Weekly Lineup: Draft 4, start 3", words: "More creative moments", button: "creative" } });
  const asked = bot.asked.filter((a) => a.kind === "gameChange").at(-1);
  check(cm.status === 200 && asked && asked.prompt.includes("They tapped a button, not typed"), "Creative moments: the change goes to our bot with the button's words", JSON.stringify(cm.body).slice(0, 300));
  const rated = bot.asked.filter((a) => a.kind === "momentsAsk");
  check(rated.length === 1 && CREATIVE.every((m) => rated[0].prompt.includes(m)) && bot.asked.filter((a) => a.kind === "momentAsk").length === 0, "...all three rated in one ask");
  const offers = (cm.body.result && cm.body.result.offers && cm.body.result.offers.moments) || [];
  check(offers.length === 2 && offers.every((m) => m.label !== "Caught a fish"), `...the two rated at the bar come back as offers (${offers.map((m) => m.label).join(", ")})`);
  const add = await alex.call("POST", `/api/seasons/${sid}/added-moments`, { ask: cm.body.id, moment: 0 });
  check(add.status === 200 && add.body.moment && add.body.moment.id, "...one added to the season", JSON.stringify(add.body).slice(0, 200));
  const again = (await alex.call("GET", `${url}&wizard=1`)).body;
  check((again.wizard.page.ctx.moments || []).some((m) => m.id === add.body.moment.id), "the page read again lists it among the moments");
  const wz2 = W.createWizard(inputOf(again));
  const withIt = { ...choice, added: [{ id: add.body.moment.id, says: add.body.moment.label, pts: 3 }] };
  const b2 = wz2.build(t.season, withIt);
  check(b2 && b2.r.ok && b2.r.spec.score.points && b2.r.spec.score.points[add.body.moment.id] === 3, `...a game built with it scores it (${wz2.scoreLine(t.season, withIt)})`, b2 && b2.r.why);
  const st4 = await alex.call("POST", url, { spec: b2.r.spec, tell: false });
  check(st4.status === 200, "...and starts", JSON.stringify(st4.body).slice(0, 200));
}

async function browserHalf(pool, fx, bot) {
  const headers = { "x-gys-bot": bot.url };
  const { page, close } = await open({ user: "zt_nd_jordan", pass: fixture.PASSWORD, width: WIDTH, height: 844, motion: "off", headers });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: path.join(out, `${WIDTH}-${n}.png`) });
  const sheet = page.locator("[role=dialog][data-open]");
  const scroller = () => page.locator("[data-start-screen]").locator("xpath=..");
  const wide = async (where) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(w <= WIDTH, `${where}: nothing wider than the screen (${w})`);
  };
  /** Yellow fills on screen (bg-chyron): only Start it, and only on the sheet's home. */
  const yellows = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog][data-open] *")].filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        return getComputedStyle(el).backgroundColor === "rgb(255, 197, 49)";
      }).length
    );
  const openSheet = async () => {
    await page.goto(`${BASE}/show/${fx.seasonId}/games`);
    await page.locator("[data-start-row]").first().click();
    await page.locator("[data-start-screen=home]").waitFor({ timeout: 30000 });
  };
  const sid = fx.seasonId;
  const leaguesNow = async () => (await pool.query("SELECT id, name, deleted_at FROM leagues WHERE couch_id = $1 ORDER BY created_at", [fx.couchId])).rows;

  // Opens, Tonight by default, the one yellow.
  await openSheet();
  check((await page.locator("[data-start-mode=tonight][aria-checked=true]").count()) === 1, "the wizard opens on Tonight (mid-season)");
  check(/1 ep/i.test(await page.locator("[data-start-readout]").innerText()), `the readout: ${(await page.locator("[data-start-readout]").innerText()).replace(/\n/g, " · ")}`);
  check((await page.locator("[data-start-game]").count()) >= 4 && (await page.locator("[data-start-card]").count()) === 1, `the rail (${await page.locator("[data-start-game]").count()}) and the game card`);
  check((await yellows()) === 1, `Start it is the one yellow (${await yellows()})`);
  await shot("01-home");
  await wide("home");

  // One tap: tonight's game, then Undo.
  const before = (await leaguesNow()).length;
  await sheet.locator("[data-start-go]").click();
  await page.locator('[data-toast="done"]').waitFor({ timeout: 15000 });
  const toastText = await page.locator('[data-toast="done"]').innerText();
  const afterStart = await leaguesNow();
  check(afterStart.length === before + 1 && /in 10 seconds/.test(toastText), `one tap started tonight's game: "${toastText.replace(/\n/g, " ")}"`);
  await shot("02-started");
  await page.locator('[data-toast="done"] button').click();
  await page.waitForFunction(() => /taken back/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  const undone = (await leaguesNow()).at(-1);
  check(undone && undone.deleted_at, "Undo takes it back");

  // The season's game, changed.
  await openSheet();
  await page.locator("[data-start-mode=season]").click();
  await page.waitForTimeout(300);
  check(/rest of the season/i.test(await page.locator("[data-start-readout]").innerText()), "The season: the rest of it");
  await page.locator("[data-start-quick=comp]").click();
  await page.waitForTimeout(300);
  check((await page.locator("[data-start-changes]").count()) === 1, `More competitive: Your version (${await page.locator("[data-start-changes]").innerText().catch(() => "")})`);
  await page.locator("[data-start-step=each]").click();
  await page.locator("[data-start-stepscreen=each]").waitFor();
  check((await page.locator("[data-start-twist]").count()) > 0, "a step's screen: its kinds, its count, its twists");
  await shot("03-step");
  await page.locator('[data-start-twist="captain"]').click().catch(() => {});
  await page.locator("[data-sheet-back]").click();
  await page.locator("[data-start-cardrow=bets]").click();
  await page.locator("[data-start-bets]").waitFor();
  await page.locator("[data-start-bet]").nth(1).click().catch(() => {});
  await page.locator("[data-sheet-back]").click();
  await page.locator("[data-start-cardrow=scores]").click();
  await page.locator("[data-start-scores]").waitFor();
  check((await page.locator("[data-start-moment]").count()) > 0 || (await page.locator("[data-start-scores=questions]").count()) === 1, "What scores: its rows");
  await shot("04-scores");
  await wide("What scores");
  await page.locator("[data-sheet-back]").click();
  await page.locator("[data-start-rules]").click();
  check((await page.locator("[data-start-rulesscreen] li").count()) > 0, "How it plays: the engine's rules");
  await page.locator("[data-sheet-back]").click();
  await page.locator("[data-start-all]").click();
  check((await page.locator("[data-start-every]").count()) >= 4, "Every game");
  await page.locator("[data-sheet-back]").click();

  // Custom: episodes picked like dates.
  await page.locator("[data-start-mode=custom]").click();
  await page.locator('[data-start-cview="episodes"]').click().catch(() => {});
  await page.locator('[data-start-ep="7"]').click();
  await page.locator('[data-start-ep="9"]').click();
  await page.waitForTimeout(200);
  const ro = await page.locator("[data-start-readout]").innerText();
  check(/3 eps/i.test(ro) && /7 to 9/i.test(ro), `Custom: 7, then 9 (${ro.replace(/\n/g, " · ")})`);
  await shot("05-custom");

  // Surprise me.
  await page.locator("[data-start-shuffle]").click();
  await page.waitForTimeout(300);
  check((await page.locator("[data-start-keep]").count()) === 2, `Surprise me: the keeps (${await page.locator("[data-start-name]").innerText()})`);

  // Describe a new game: the wait, the result, Change it in the sheet.
  bot.delayMs = 2500;
  await page.locator("[data-start-describe]").click();
  await page.locator("[data-start-words]").fill(g01().words);
  await sheet.locator("[data-start-build]").click();
  await page.locator("[data-start-wait]").waitFor();
  await shot("06-wait");
  check((await yellows()) <= 1, "the wait: no second yellow");
  await page.locator("[data-start-result]").waitFor({ timeout: 30000 });
  check((await page.locator("[data-start-yourwords] .underline").count()) > 0, "the result: their words, what made it in underlined");
  await shot("07-result");
  await wide("the result");
  await page.locator("[data-start-usetyped]").click();
  await page.locator("[data-start-screen=home]").waitFor();
  check(/your words/i.test(await sheet.innerText()), `Change it in the sheet: the typed game on the card (${await page.locator("[data-start-name]").innerText()})`);

  // Keep going, then See it.
  await page.locator("[data-start-describe]").click();
  await page.locator("[data-start-words]").fill(g01().words);
  await sheet.locator("[data-start-build]").click();
  await page.locator("[data-start-keepgoing]").click();
  await page.waitForFunction(() => /ready/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
  const seeIt = page.locator('[data-toast] button:has-text("See it")');
  check((await seeIt.count()) === 1, "Keep going: a See it toast when it's ready");
  await seeIt.click().catch(() => {});
  await page.locator("[data-start-result]").waitFor({ timeout: 10000 }).catch(() => {});
  check((await page.locator("[data-start-result]").count()) === 1, "...See it opens the result");
  bot.delayMs = 0;

  // The errors: our AI away, no game in the words, today's 10.
  await page.locator("[data-start-editwords]").click();
  bot.down = true;
  await page.locator("[data-start-words]").fill("Something new, please");
  await sheet.locator("[data-start-build]").click();
  await page.locator('[data-start-error="away"]').waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator('[data-start-error="away"]').count()) === 1 && (await page.locator("[data-start-words]").inputValue()) === "Something new, please", "our AI away: said, and the words kept");
  await shot("08-away");
  bot.down = false;
  await sheet.locator("[data-start-build]").click();
  await page.locator('[data-start-error="none"]').waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator('[data-start-error="none"]').count()) === 1, "no game in the words: said, with starters");
  await pool.query("INSERT INTO game_word_asks (user_id, season_id, words) SELECT $1, $2, 'filler' FROM generate_series(1, 10)", [fx.users.jordan, sid]);
  await page.locator("[data-start-words]").fill("Draft 3 each, most points wins");
  await sheet.locator("[data-start-build]").click();
  await page.locator('[data-start-error="limit"]').waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator('[data-start-error="limit"]').count()) === 1, "today's 10: said");
  await pool.query("DELETE FROM game_word_asks WHERE user_id = $1 AND words = 'filler'", [fx.users.jordan]);
  await page.locator("[data-sheet-back]").click();

  // Creative moments, through to one added.
  await page.locator("[data-start-mode=season]").click();
  await page.locator('[data-start-game="lineup"]').click();
  await page.locator("[data-start-quick=creative]").click();
  await page.locator("[data-start-moments]").waitFor({ timeout: 30000 }).catch(() => {});
  check((await page.locator("[data-start-newmoment]").count()) === 2, `Creative moments: the offers (${await page.locator("[data-start-newmoment]").count()})`);
  await shot("09-moments");
  await page.locator("[data-start-newmoment]").nth(1).locator("[role=switch]").click();
  await page.locator("[data-start-addmoments]").click();
  await page.locator("[data-start-screen=home]").waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  check(/1 of your own/.test(await page.locator("[data-start-cardrow=scores]").innerText()), `...added: ${await page.locator("[data-start-cardrow=scores]").innerText().catch(() => "")}`);
  await shot("10-added");
  await wide("after Creative moments");

  // Make it a game, chained: a ready show's page hands off to the wizard.
  await page.goto(`${BASE}/show/${sid}/games?page=make&then=start&couch=${fx.couchId}`);
  await page.locator("[data-start-screen=home]").waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator("[data-start-screen=home]").count()) === 1, "Make it a game, chained: once the show's a game, Start a game opens on it");

  check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
  await close();
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  const bot = await fakeBot.start({ answer: answers });
  try {
    const fx = await fixture.up(pool);
    if (ONLY !== "browser") await apiHalf(pool, fx, bot);
    // The browser's half on a fresh couch (the API's games and the moment it added gone with the old one).
    if (ONLY !== "api") await browserHalf(pool, ONLY === "browser" ? fx : await fixture.up(pool), bot);
  } catch (e) {
    failures++;
    console.log(`FAIL  crashed: ${e && e.stack}`);
  } finally {
    await bot.close();
    if (!KEEP) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})();
