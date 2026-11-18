// Dev-only check for Start a game (docs/PLAN-start-a-game-redo.md B1: the bold gallery, src/new/couch/gallery-bold/, for every
// start; the catalog src/lib/game/start-gallery; the server's src/lib/server/start-spec.ts), against the dev server, on
// new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51's three linked games; results through Episode 5; Episode 6
// three days out) with the stand-in bot (fake-bot.js, by the x-gys-bot header): no real bot is asked.
//   API:
//   - the page (GET /start?wizard=1): the ctx and pack the sheet checks on, the couch's 4, the cast as alex has seen it (no exit
//     past alex's mark), asks left, who Start tells (the three who play there);
//   - Start from a spec: a catalog game (Fantasy League with a captain, built by the catalog's own change) checked again and made,
//     alex its Commissioner, linked into the couch's group, its spec as built, a line in Recent changes; the couch told only after
//     the 10-second hold; Undo inside the hold takes it back (deleted, restorable) and nobody hears; Undo too late, or someone
//     else's, is refused; a game in stages (the redraft) made with a league for each stage; refusals (a start the listing doesn't
//     have, a spec our check refuses, computer players on a question they don't answer yet (trivia), someone not on the couch); computer
//     players answering a Prediction sheet (at once Together; at your own pace, each week as alex reveals the one before, never past
//     the game: E1b), answering a boot order and staking the Bank game's (E1b), playing Bingo and Weekly Calls (E1c);
//   - Run it back's page: `again` gives the old game's rules (`againSpec`, its dates left out);
//   - a moment added for research from our AI's offer (added-moments: what Describe's "Add it for research" calls), read back
//     on the page and scored by a game built with it.
//   In a real browser at --width (390 by default), as jordan: the Games tab's Start a game opens the gallery (Choose a game, the
//   ready game, the chips, nothing wider than the screen, no yellow before a game's screen); the ready game opens Ready to start and
//   Start makes it (the toast's Undo, the game's own page), Undo takes it back; a base's screen (How long's cards, the two lock
//   cards, Make it…, a rule's change screen and Done, the yellow Start alone), Computer players in Who's playing (two, sharp: the
//   Start bar says them, the game has their seats; offered on a Prediction sheet at either pace and on Prop bets, dashed with the
//   reason on Redraft, a game in stages), and Start on Together (its
//   pace written live);
//   saved games (the heart beside Start keeps it on the account, Community and saved games lists it and reopens it for the length
//   it was saved with, the heart takes it off, a browser's older saves move up once); Include it on an episode on now (the fixture's Episode 6 moved to half an hour ago, then back); Describe (the wait, the result
//   from the stand-in bot, Start it to Ready to start; words asking for computer players start with them: E1d), leaving it (a See it toast reopens it), and its errors (our AI away with the
//   words kept, no game in the words, today's asks used); Make it a game chained (a ready show's ?page=make&then=start opens the
//   gallery); the first-time tour's practice (its strip, Start ends in the practice finish, nothing made). No page errors.
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
const GM = require("../../src/lib/game/start-gallery/index.js");
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

// The stand-in's answers: the bank's g01 for its words; a typed change, three new moments; their ratings, one ask.
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
  // E1d: the same words asking for computer players: the recorded answer with them beside the game.
  const plain = words.endsWith(BOTS_WORDS) ? words.slice(0, -BOTS_WORDS.length) : words;
  const c = B.cases().find((x) => x.words === plain);
  // (The recorded answer is the bot's words around its JSON: the field goes in the JSON as it's written.)
  if (c && plain !== words) return B.answerOf(c).replace('{"draft":1,', '{"draft":1,"bots":{"n":2,"level":"sharp"},');
  return c ? B.answerOf(c) : '{"game":null,"said":[],"assumed":[],"ask":[],"cantYet":[],"summary":"nothing"}';
}
const BOTS_WORDS = " with two computer players";

/** A catalog base's game on the page, from the next episode to the season's end (as the sheet opens it). */
function baseGame(o, id, span) {
  const pg = GM.pageFacts(o.wizard.page, { show: o.label });
  const sp = span || { from: o.from, to: null };
  const spec = GM.baseSpec(GM.baseById(id), sp, pg);
  return { pg, spec: spec ? { ...spec, span: Array.isArray(spec.stages) ? undefined : sp } : null };
}

async function apiHalf(pool, fx, bot) {
  const headers = { "x-gys-bot": bot.url };
  const alex = await signIn({ user: "zt_nd_alex", pass: fixture.PASSWORD, headers });
  const couch = fx.couchId;
  const sid = fx.seasonId;
  const url = `/api/seasons/${sid}/start?couch=${couch}`;

  const r0 = await alex.call("GET", `${url}&wizard=1`);
  const o = r0.body;
  check(r0.status === 200 && o.wizard && o.wizard.page.ctx && o.wizard.page.pack, "the page: the ctx and pack the sheet checks on", JSON.stringify(r0.body).slice(0, 300));
  const pack = o.wizard.page.pack;
  check(pack.couch && pack.couch.people === 4, `...the couch's 4 (${pack.couch && pack.couch.people})`);
  check(pack.cast.length > 0 && pack.cast.every((c) => !c.out || c.out.episode <= 5), "...the cast as alex has seen it (no exit past Episode 5)");
  check(o.wizard.asksLeft === 10 && o.wizard.tells === 3 && o.from === 6 && o.againSpec === null, `...asks left ${o.wizard.asksLeft}, Start tells ${o.wizard.tells}, from Episode ${o.from}, no Run it back`);

  // A catalog game, changed by the catalog's own change.
  const { pg, spec: fantasy } = baseGame(o, "fantasy");
  const v0 = GM.check(fantasy, pg);
  check(v0.ok, `Fantasy League plays here: ${v0.short && v0.short.line}`, JSON.stringify(v0.problems));
  const captained = GM.applyChange(fantasy, "captain", pg);
  const v1 = GM.check(captained, pg);
  check(v1.ok && captained.score && captained.score.captain, `...with a captain: ${v1.short && v1.short.line}`, JSON.stringify(v1.problems));

  // Start from a spec.
  const before = Date.now();
  const st = await alex.call("POST", url, { spec: captained, name: "Fantasy League", tell: true, pace: "live", made: { how: "base", base: "fantasy" } });
  check(st.status === 200 && st.body.leagueId && st.body.holdMs === 10000 && st.body.told === 3, "Start: made, the couch told after a 10-second hold", JSON.stringify(st.body).slice(0, 300));
  const lid = st.body.leagueId;
  const { rows: made } = await pool.query("SELECT l.name, l.group_id, l.state, m.role FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.user_id = $2 WHERE l.id = $1", [lid, fx.users.alex]);
  check(made[0] && made[0].role === "commissioner" && made[0].group_id, "...alex its Commissioner, linked into the couch's group");
  const kept = made[0] ? G.specOf(made[0].state.settings) : null;
  check(kept && kept.score && kept.score.captain && kept.get.each === captained.get.each, "...its spec as built (the team's size, the captain)", JSON.stringify(kept && { get: kept.get, score: kept.score }).slice(0, 300));
  const { rows: ch } = await pool.query("SELECT text, detail FROM league_changes WHERE league_id = $1 AND kind = 'game.start'", [lid]).catch(() => ({ rows: [] }));
  check(ch.length === 1 && /zt_nd_alex started/.test(ch[0].text) && ch[0].detail && ch[0].detail.made && ch[0].detail.made.base === "fantasy", `...a line in Recent changes, with the base it came from: "${ch[0] && ch[0].text}"`);
  const told = async (leagueId) => (await pool.query("SELECT count(*)::int AS n FROM notifications WHERE key = $1", [`started:${leagueId}`])).rows[0].n;
  check((await told(lid)) === 0, "...nobody's told inside the hold");

  // Undo inside the hold, on a second game (tonight's Prediction sheet).
  const { spec: sheet } = baseGame(o, "sheet", { from: o.from, to: o.from });
  const st2 = await alex.call("POST", url, { spec: sheet, name: "Prediction sheet", tell: true });
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

  // A game in stages: its game and a league for each stage it starts with.
  const { spec: staged } = baseGame(o, "redraft");
  if (staged && GM.check(staged, pg).ok) {
    const st3 = await alex.call("POST", url, { spec: staged, name: "Redraft", tell: false, pace: "live" });
    const { rows: stages } = st3.status === 200 ? await pool.query("SELECT stage_key FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL", [st3.body.leagueId]) : { rows: [] };
    check(st3.status === 200 && stages.length >= 1, `a game in stages is made, with its stage leagues (${st3.status}: ${stages.map((s) => s.stage_key).join(", ") || (st3.body && st3.body.error)})`);
  } else check(false, "the redraft plays on the fixture's season", JSON.stringify(staged && GM.check(staged, pg).problems));

  // Refusals.
  const aired = await alex.call("POST", url, { spec: { ...captained, span: { from: 99, to: null } }, tell: false });
  check(aired.status === 409 || aired.status === 400, `a start the listing doesn't have (${aired.status}: ${aired.body && aired.body.error})`);
  const bad = await alex.call("POST", url, { spec: { ...captained, get: { by: "draft", each: 99, own: "exclusive" } }, tell: false });
  check(bad.status === 409, `a spec our check refuses (${bad.status}: ${bad.body && bad.body.error})`);
  // E1b: computer players answer a Prediction sheet's questions, written as soon as it starts; a Bingo card they don't play yet.
  const bots = await alex.call("POST", url, { spec: sheet, tell: false, bots: 2, level: "sharp" });
  const { rows: botAnswers } = bots.status === 200 ? await pool.query("SELECT player_id, question, episode, answer FROM game_answers WHERE league_id = $1", [bots.body.leagueId]) : { rows: [] };
  const asks = (sheet.ask || []).length;
  check(bots.status === 200 && botAnswers.length === 2 * asks, `computer players on a Prediction sheet: started, their ${2 * asks} answers in at once (${botAnswers.length}: ${botAnswers.map((a) => `${a.question}=${JSON.stringify(a.answer)}`).slice(0, 3).join(", ")})`, JSON.stringify(bots.body).slice(0, 200));
  const { spec: bingo } = baseGame(o, "bingo", { from: o.from, to: o.from });
  // E1c: Bingo and Weekly Calls take computer players (cards dealt by seat and ticked from what's settled; calls guessed), and the
  // season's games read lists them as computer players with a count of their own.
  const bingoBots = await alex.call("POST", url, { spec: bingo, tell: false, bots: 1, pace: "live" });
  check(bingoBots.status === 200, `computer players on a Bingo card: started (${bingoBots.status}: ${bingoBots.body && (bingoBots.body.error || bingoBots.body.name)})`);
  const callsBots = await alex.call("POST", url, { spec: { preset: "weekly-calls", span: { from: o.from, to: null } }, name: "Weekly Calls", tell: false, bots: 2, pace: "live" });
  check(callsBots.status === 200, `computer players in Weekly Calls: started (${callsBots.status}: ${callsBots.body && (callsBots.body.error || callsBots.body.name)})`);
  const read = (await alex.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body;
  const rowsOf = (id) => (((read.games || []).find((g) => g.leagueId === id) || {}).table || []);
  const botRows = [...rowsOf(bingoBots.body && bingoBots.body.leagueId), ...rowsOf(callsBots.body && callsBots.body.leagueId)].filter((r) => r.bot);
  check(botRows.length === 3 && botRows.every((r) => !r.userId), `...the games read lists their 3 computer players as such (${botRows.map((r) => r.name).join(", ")})`);
  // E1b's second slice: an order, confidence, chips, pairs and a split they answer, and stakes; trivia (the round's key) not yet.
  const orderBots = await alex.call("POST", url, { spec: { ...sheet, ask: [...(sheet.ask || []), { id: "ord", ask: "The order they go", answer: "order", points: 2, asked: "once", pick: 5, within: 2, settle: { by: "results", take: "order" } }] }, name: "Order with a bot", tell: false, bots: 1, pace: "live" });
  const { rows: ordered } = orderBots.status === 200 ? await pool.query("SELECT answer FROM game_answers WHERE league_id = $1 AND question = 'ord'", [orderBots.body.leagueId]) : { rows: [] };
  check(orderBots.status === 200 && ordered.length === 1 && Array.isArray(ordered[0].answer) && ordered[0].answer.length === 5, `computer players on a boot order: started, its five in order at once (${orderBots.status}: ${(orderBots.body && orderBots.body.error) || JSON.stringify(ordered.map((r) => r.answer))})`);
  // E1b's second slice: the Bank game's stakes (each a share of what's left of the bank as it stands) and a ticket of its own answers.
  const { spec: bankSpec } = baseGame(o, "bank");
  const bankBots = bankSpec ? await alex.call("POST", url, { spec: bankSpec, name: "Bank with a bot", tell: false, bots: 1, pace: "live" }) : { status: 0, body: { error: "no Bank game here" } };
  const { rows: banked } = bankBots.status === 200 ? await pool.query("SELECT question, answer FROM game_answers WHERE league_id = $1", [bankBots.body.leagueId]) : { rows: [] };
  const stakes = banked.map((r) => r.answer && r.answer.stake);
  const ticket = (banked.find((r) => r.question === "ticket") || {}).answer;
  check(
    bankBots.status === 200 && banked.length === (bankSpec.ask || []).length && stakes.every((n) => Number.isInteger(n) && n >= 0) && stakes.reduce((a, b) => a + b, 0) <= 500 && ticket && ticket.legs.every((id) => banked.some((r) => r.question === id)),
    `computer players on the Bank game: started, every answer staked within the bank (${stakes.join(" + ")} of 500), the ticket on its own answers (${ticket ? ticket.legs.join(", ") : "none"})`,
    bankBots.body && bankBots.body.error
  );
  const noBots = await alex.call("POST", url, { spec: { ...sheet, ask: [...(sheet.ask || []), { id: "triv", ask: "Trivia about the episode before", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } }] }, tell: false, bots: 1, pace: "live" });
  check(noBots.status === 409 && /Computer players/.test((noBots.body && noBots.body.error) || ""), `computer players on a question they don't answer yet (trivia): refused (${noBots.status}: ${noBots.body && noBots.body.error})`);
  // E1b's second slice: at your own pace too. Each catches up with whoever reveals first, answering each week (and the week after's,
  // so it's in before anyone opens it) on its own copy before it: Episode 1's at the start, Episode 2's on revealing Episode 1, and
  // nothing past the game's last.
  const ownBots = await alex.call("POST", url, { spec: { ...sheet, span: { from: 1, to: 3 } }, name: "Own pace with a bot", tell: false, bots: 1, pace: "own" });
  const ownRows = async () => (ownBots.status === 200 ? (await pool.query("SELECT question, episode FROM game_answers WHERE league_id = $1 ORDER BY episode, question", [ownBots.body.leagueId])).rows : []);
  const weeks = (rows) => [...new Set(rows.map((r) => r.episode))].join(",");
  const asked = (sheet.ask || []).length;
  const own0 = await ownRows();
  check(ownBots.status === 200 && own0.length === asked && weeks(own0) === "1", `computer players on a Prediction sheet at your own pace: started, Episode 1's ${asked} answers in (${ownBots.status}: ${ownBots.body && ownBots.body.error || `${own0.length} for ${weeks(own0)}`})`);
  const reveals = [];
  for (let i = 0; i < 3 && ownBots.status === 200; i++) {
    const r = await alex.call("POST", `/api/seasons/${sid}/catchup`, { leagueId: ownBots.body.leagueId, couch });
    reveals.push(r.status === 200 ? weeks(await ownRows()) : `${r.status} ${r.body && r.body.error}`);
  }
  const own3 = await ownRows();
  check(reveals.join(" | ") === "1,2 | 1,2,3 | 1,2,3" && own3.length === 3 * asked, `...revealing Episodes 1-3: Episode 2's, then 3's, then nothing past the game (${reveals.join(" | ")}; ${own3.length} answers)`);
  const casey = await signIn({ user: "zt_nd_casey", pass: fixture.PASSWORD, headers });
  const off = await casey.call("POST", url, { spec: captained, tell: false });
  check(off.status === 403 || off.status === 404, `someone not on the couch (${off.status})`);

  // Run it back's page: the old game's rules, its dates left out.
  const back = await alex.call("GET", `${url}&wizard=1&again=${lid}`);
  const as = back.body && back.body.againSpec;
  check(back.status === 200 && as && !as.span && as.score && as.score.captain && back.body.again && back.body.again.leagueId === lid, "Run it back's page: the old game's rules (the captain), its dates left out", JSON.stringify(back.body && { again: back.body.again, as }).slice(0, 300));

  // A moment added for research, from our AI's offer (Describe's "Add it for research"), then scored.
  const wordsUrl = `/api/seasons/${sid}/game-words`;
  const cm = await alex.call("POST", wordsUrl, { couch, change: { spec: captained, game: "Fantasy League", words: "Count crying too" } });
  const offers = (cm.body.result && cm.body.result.offers && cm.body.result.offers.moments) || [];
  check(cm.status === 200 && offers.length === 2, `our AI offers the moments research could answer (${offers.map((m) => m.label).join(", ")})`, JSON.stringify(cm.body).slice(0, 300));
  const add = await alex.call("POST", `/api/seasons/${sid}/added-moments`, { ask: cm.body.id, moment: 0 });
  check(add.status === 200 && add.body.moment && add.body.moment.id, "...one added to the season", JSON.stringify(add.body).slice(0, 200));
  const again = (await alex.call("GET", `${url}&wizard=1`)).body;
  check((again.wizard.page.ctx.moments || []).some((m) => m.id === add.body.moment.id), "the page read again lists it among the moments");
  const pg2 = GM.pageFacts(again.wizard.page, { show: again.label });
  const one = GM.baseSpec(GM.baseById("onemoment") || GM.baseById("fantasy"), { from: again.from, to: null }, pg2, add.body.moment.id);
  const withIt = one && GM.check({ ...one, span: { from: again.from, to: null } }, pg2);
  check(withIt && withIt.ok, `...a game on that one moment plays (${withIt && withIt.short && withIt.short.line})`, JSON.stringify(withIt && withIt.problems));
}

async function browserHalf(pool, fx, bot) {
  const headers = { "x-gys-bot": bot.url };
  const { page, close } = await open({ user: "zt_nd_jordan", pass: fixture.PASSWORD, width: WIDTH, height: 844, motion: "off", headers });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const shot = (n) => page.screenshot({ path: path.join(out, `${WIDTH}-${n}.png`) });
  const sheet = page.locator("[role=dialog][data-open]");
  const wide = async (where) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(w <= WIDTH, `${where}: nothing wider than the screen (${w})`);
  };
  /** Yellow buttons on screen (bg-chyron): Start alone, and only once a game is chosen (the step line's lit segment isn't one). */
  const yellows = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog][data-open] button")].filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.top > innerHeight) return false;
        return getComputedStyle(el).backgroundColor === "rgb(255, 197, 49)";
      }).length
    );
  const sid = fx.seasonId;
  const openSheet = async () => {
    await page.goto(`${BASE}/show/${sid}/games`);
    await page.locator("[data-start-row], [data-play-start]").first().click({ timeout: 60000 });
    await page.locator("[data-gallery=gallery]").waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
  };
  const tap = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click();
    await page.waitForTimeout(350);
  };
  const leaguesNow = async () => (await pool.query("SELECT id, name, deleted_at, state FROM leagues WHERE couch_id = $1 AND stage_of IS NULL ORDER BY created_at", [fx.couchId])).rows;
  const toastDone = async () => {
    await page.locator('[data-toast="done"]').waitFor({ timeout: 20000 });
    return (await page.locator('[data-toast="done"]').innerText()).replace(/\n/g, " ");
  };

  // The gallery: its step line, the ready game, the chips, no yellow yet.
  await openSheet();
  const head = await sheet.innerText();
  check(/Choose a game/.test(head) && (await page.locator("[data-gallery-chip]").count()) >= 4, `the gallery opens: Choose a game, ${await page.locator("[data-gallery-chip]").count()} chips`);
  const ready = (await page.locator("[data-gallery-ready-start]").count()) === 1;
  console.log(`      (${ready ? "a ready game for the next episode" : "no ready game on this season: tonight's Prediction sheet instead"})`);
  check((await yellows()) === 0, `...no yellow before a game is chosen (${await yellows()})`);
  await shot("01-gallery");
  await wide("the gallery");

  // The ready game (or tonight's Prediction sheet): Ready to start, then Start, then Undo.
  const before = (await leaguesNow()).length;
  if (ready) {
    await tap("[data-gallery-ready-start]");
    await page.locator("[data-gallery=done]").waitFor({ timeout: 10000 });
    check(/Ready to start/.test(await sheet.innerText()) && (await page.locator("[data-gallery-start]").count()) === 1, "the ready game opens Ready to start, its Start bar docked");
  } else {
    await tap('[data-gallery-lead="sheet"], [data-gallery-base="sheet"]');
    await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
    await tap("[data-gallery-option=length-next]");
    check((await page.locator("[data-gallery-option=length-next][data-chosen]").count()) === 1, "tonight's Prediction sheet: Just Episode 6 chosen");
  }
  await shot("02-ready");
  await page.locator("[data-gallery-start]").click();
  const t1 = await toastDone();
  await page.waitForURL(/\/game\//, { timeout: 20000 }).catch(() => {});
  const afterStart = await leaguesNow();
  check(afterStart.length === before + 1 && /started/.test(t1) && /\/game\//.test(page.url()), `Start makes it and opens its page: "${t1}"`);
  await shot("03-started");
  await page.locator('[data-toast="done"] button').click();
  await page.waitForFunction(() => /taken back/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  check(!!(await leaguesNow()).at(-1)?.deleted_at || (await leaguesNow()).length === before, "Undo takes it back");

  // A base's screen: How long, the two lock cards, Make it…, a rule's change, the one yellow; Start on Together.
  await openSheet();
  await tap('[data-gallery-lead="fantasy"], [data-gallery-base="fantasy"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  check((await page.locator("[data-gallery-option^=length-]").count()) >= 2, `How long?: ${await page.locator("[data-gallery-option^=length-]").count()} length cards`);
  check((await page.locator("[data-gallery-option=lock-live]").count()) === 1 && (await page.locator("[data-gallery-option=lock-own]").count()) === 1, "Together, or at your own pace?: the two plain cards");
  check((await page.locator("[data-gallery-preview], [data-gallery-ask], [data-gallery-row=own]").count()) === 0, "...Try it, Ask the couch first and your own moments held back until they play");
  check((await yellows()) === 1, `...Start the one yellow (${await yellows()})`);
  await shot("04-base");
  await wide("a game's screen");
  await tap("[data-gallery-option=lock-live]");
  check(/Together/.test(await page.locator("[data-gallery-stretch]").innerText()), `the Start bar says Together: ${await page.locator("[data-gallery-stretch]").innerText()}`);
  await tap("[data-gallery-row=who]");
  await page.locator("[data-gallery=change]").waitFor({ timeout: 10000 });
  check((await page.locator("[data-gallery-choice]").count()) >= 2, `a rule's change screen: ${await page.locator("[data-gallery-choice]").count()} choices`);
  // E1a: Computer players in Who's playing: on, two of them, sharp; their controls under the square.
  await tap('[data-gallery-choice="bot"]');
  await page.locator('[data-gallery-controls] [data-control="n"]').waitFor({ timeout: 5000 }).catch(() => {});
  await tap('[data-gallery-controls] [data-control="n"] button[aria-label^="More"]');
  await tap('[data-gallery-controls] [data-control="level"] [data-option="sharp"]');
  check((await page.locator('[data-gallery-choice="bot"][data-chosen]').count()) === 1 && /2 computer players/.test(await page.locator('[data-gallery-choice="bot"]').innerText()), `Computer players: on, two of them (${(await page.locator('[data-gallery-choice="bot"]').innerText()).replace(/\n/g, " ")})`);
  await shot("04b-bots");
  await tap("[data-gallery-done]");
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  check(/2 computer players/.test(await page.locator("[data-gallery-startbar]").innerText()), `the Start bar says them: ${(await page.locator("[data-gallery-startbar]").innerText()).replace(/\n/g, " · ")}`);
  const n0 = (await leaguesNow()).length;
  await page.locator("[data-gallery-start]").click();
  await toastDone();
  await page.waitForURL(/\/game\//, { timeout: 20000 }).catch(() => {});
  const fantasy = (await leaguesNow()).at(-1);
  const pace = fantasy && fantasy.state && fantasy.state.settings && fantasy.state.settings.pace;
  check((await leaguesNow()).length === n0 + 1 && pace !== "own", `Start on Together: made, live (${pace ?? "live"})`);
  const seats = ((fantasy && fantasy.state && fantasy.state.players) || []).filter((x) => x.automated);
  check(seats.length === 2 && seats.every((x) => x.botLevel === "sharp"), `...with its two computer players, sharp (${seats.map((x) => `${x.name}: ${x.botLevel}`).join(", ")})`);
  // A Prediction sheet's questions they answer (E1b): offered; a Bingo card's lines they don't play yet: dashed with the reason.
  await openSheet();
  await tap('[data-gallery-lead="sheet"], [data-gallery-base="sheet"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  // At your own pace (where a show's game starts) offered too (E1b's second slice: they answer as they catch up); Together, offered.
  if ((await page.locator("[data-gallery-option=lock-own][data-chosen]").count()) === 1) {
    await tap("[data-gallery-row=who]");
    check((await page.locator('[data-gallery-choice="bot"]:not([data-off])').count()) === 1, "on a Prediction sheet at your own pace, Computer players offered: they answer each week as they catch up");
    await tap("[data-gallery-done]");
    await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  }
  await tap("[data-gallery-option=lock-live]");
  await tap("[data-gallery-row=who]");
  check((await page.locator('[data-gallery-choice="bot"]:not([data-off])').count()) === 1, "on a Prediction sheet played Together, Computer players offered: they answer its questions");
  await openSheet();
  await tap('[data-gallery-lead="props"], [data-gallery-base="props"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  await tap("[data-gallery-row=who]");
  check((await page.locator('[data-gallery-choice="bot"]:not([data-off])').count()) === 1, "on Prop bets, Computer players offered: they answer the card's lines once it's out, and stake (E1b)");
  // A game in stages: not yet, so dashed with the reason.
  await openSheet();
  await tap('[data-gallery-lead="redraft"], [data-gallery-base="redraft"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  await tap("[data-gallery-row=who]");
  check((await page.locator('[data-gallery-choice="bot"][data-off]').count()) === 1 && /stages later/.test(await page.locator('[data-gallery-choice="bot"]').innerText()), "on Redraft (a game in stages), Computer players dashed: they play a game in stages later");
  await shot("05-fantasy-page");

  // Saved games on the account: the heart beside Start, the row in Community and saved games, reopened, taken off; and a browser's
  // saves from before the account kept them move up once.
  const savedRows = async () => (await pool.query("SELECT key, base, name, length, saved_on FROM saved_games WHERE user_id = $1 ORDER BY created_at", [fx.users.jordan])).rows;
  await pool.query("DELETE FROM saved_games WHERE user_id = $1", [fx.users.jordan]);
  await openSheet();
  await tap('[data-gallery-lead="fantasy"], [data-gallery-base="fantasy"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
  await tap("[data-gallery-option=length-next]");
  await tap("[data-gallery-save]");
  await page.waitForFunction(() => /Saved/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  let rows = await savedRows();
  check(rows.length === 1 && rows[0].base === "fantasy" && rows[0].length === "one" && /Survivor/.test(rows[0].saved_on), `the heart saves it on the account (${rows.map((r) => `${r.name}, ${r.length}`).join("; ")})`);
  await shot("05b-saved");
  await openSheet();
  const toggle = page.locator("[data-gallery-community-toggle]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.locator("[data-gallery-saved-row]").first().waitFor({ timeout: 10000 }).catch(() => {});
  check((await page.locator('[data-gallery-saved-row="fantasy"]').count()) === 1, "...in Community and saved games, under Saved");
  await tap('[data-gallery-saved-row="fantasy"]');
  await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 }).catch(() => {});
  check((await page.locator("[data-gallery-option=length-next][data-chosen]").count()) === 1, "...reopened on its screen, for the length it was saved with");
  await tap("[data-gallery-save]");
  await page.waitForFunction(() => /Taken off/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  check((await savedRows()).length === 0, "...and the heart again takes it off");
  const old = GM.baseSpec(GM.baseById("pool"), { from: 6, to: null }, GM.pageFacts((await (await signIn({ user: "zt_nd_jordan", pass: fixture.PASSWORD })).call("GET", `/api/seasons/${sid}/start?couch=${fx.couchId}&wizard=1`)).body.wizard.page));
  await page.evaluate((spec) => localStorage.setItem("gys_saved_games", JSON.stringify([{ key: "x", name: "Old pool", base: "pool", spec, length: "season", from: "base", savedAt: new Date().toISOString(), on: "ZT Survivor 51" }])), old);
  await openSheet();
  await page.waitForTimeout(1500);
  rows = await savedRows();
  const left = await page.evaluate(() => localStorage.getItem("gys_saved_games"));
  check(rows.length === 1 && rows[0].name === "Old pool" && !left, `a browser's older saves move up to the account once (${rows.map((r) => r.name).join(", ")}; left in the browser: ${left ? "yes" : "no"})`);
  await pool.query("DELETE FROM saved_games WHERE user_id = $1", [fx.users.jordan]);

  // Include it: the fixture's Episode 6 moved to half an hour ago, then back.
  const { rows: was } = await pool.query("SELECT premiere_date, air_time, air_tz FROM show_seasons WHERE id = $1", [sid]);
  await pool.query(
    `UPDATE show_seasons SET premiere_date = ((now() AT TIME ZONE air_tz) - interval '30 minutes')::date - 35,
            air_time = ((now() AT TIME ZONE air_tz) - interval '30 minutes')::time WHERE id = $1`,
    [sid]
  );
  try {
    await openSheet();
    await tap('[data-gallery-lead="fantasy"], [data-gallery-base="fantasy"]');
    await page.locator("[data-gallery=base]").waitFor({ timeout: 10000 });
    const inc = page.locator("[data-gallery-option=late]");
    check((await inc.count()) === 1, "Include it: offered while Episode 6 is on");
    if (await inc.count()) {
      await tap("[data-gallery-option=late]");
      await page.waitForFunction(() => document.querySelector("[data-gallery-option=late]")?.hasAttribute("data-chosen"), null, { timeout: 15000 }).catch(() => {});
      check((await page.locator("[data-gallery-option=late][data-chosen]").count()) === 1, "...chosen, the options read again from the episode on now");
      await shot("06-include");
    }
  } finally {
    await pool.query("UPDATE show_seasons SET premiere_date = $2, air_time = $3 WHERE id = $1", [sid, was[0].premiere_date, was[0].air_time]);
  }

  // Describe: the wait, the result, Start it to Ready to start.
  await openSheet();
  bot.delayMs = 2500;
  await tap("[data-gallery-describe]");
  await page.locator("[data-gallery-describe-words]").fill(g01().words);
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=wait]").waitFor({ timeout: 10000 });
  await shot("07-wait");
  await page.locator("[data-gallery-describe=result]").waitFor({ timeout: 30000 });
  check((await page.locator("[data-gallery-heard] mark").count()) > 0, "Describe's result: what we heard, marked");
  await shot("08-result");
  await wide("Describe's result");
  await tap("[data-gallery-describe-start]");
  await page.locator("[data-gallery=done]").waitFor({ timeout: 10000 }).catch(() => {});
  check((await page.locator("[data-gallery=done]").count()) === 1, "...Start it: Ready to start, with the game our AI made");
  // E1d: words asking for computer players: our AI's answer has them beside the game, and Ready to start says them.
  await openSheet();
  await tap("[data-gallery-describe]");
  await page.locator("[data-gallery-describe-words]").fill(g01().words + BOTS_WORDS);
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=result]").waitFor({ timeout: 30000 });
  await tap("[data-gallery-describe-start]");
  await page.locator("[data-gallery=done]").waitFor({ timeout: 10000 }).catch(() => {});
  const doneText = (await page.locator("[data-gallery-startbar]").innerText().catch(() => "")).replace(/\n/g, " · ");
  check(/2 computer players/.test(doneText), `...words asking for two computer players: Ready to start has them (${doneText.slice(0, 160)})`);

  // Leaving it: a See it toast.
  await openSheet();
  await tap("[data-gallery-describe]");
  await page.locator("[data-gallery-describe-words]").fill(g01().words);
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=wait]").waitFor({ timeout: 10000 });
  await page.locator("[data-sheet-back]").click();
  await page.waitForFunction(() => /ready/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});
  const seeIt = page.locator('[data-toast] button:has-text("See it")');
  check((await seeIt.count()) === 1, "leaving Describe: a See it toast when it's ready");
  await seeIt.click().catch(() => {});
  await page.locator("[data-gallery-describe=result]").waitFor({ timeout: 15000 }).catch(() => {});
  check((await page.locator("[data-gallery-describe=result]").count()) === 1, "...See it opens the result");
  bot.delayMs = 0;

  // The errors: our AI away, no game in the words, today's asks.
  await tap("[data-gallery-describe-words-again]");
  bot.down = true;
  await page.locator("[data-gallery-describe-words]").fill("Something new, please");
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=away]").waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator("[data-gallery-describe=away]").count()) === 1 && (await page.locator("[data-gallery-describe-words]").inputValue()) === "Something new, please", "our AI away: said, the words kept, the closest games by tapping");
  await shot("09-away");
  bot.down = false;
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=none]").waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator("[data-gallery-describe=none]").count()) === 1, "no game in the words: said");
  await pool.query("INSERT INTO game_word_asks (user_id, season_id, words) SELECT $1, $2, 'filler' FROM generate_series(1, 10)", [fx.users.jordan, sid]);
  await page.locator("[data-gallery-describe-words]").fill("Draft 3 each, most points wins");
  await tap("[data-gallery-describe-build]");
  await page.locator("[data-gallery-describe=used]").waitFor({ timeout: 20000 }).catch(() => {});
  check((await page.locator("[data-gallery-describe=used]").count()) === 1, "today's asks used: said");
  await pool.query("DELETE FROM game_word_asks WHERE user_id = $1 AND words = 'filler'", [fx.users.jordan]);

  // Make it a game, chained: a ready show's page hands off to Start a game.
  await page.goto(`${BASE}/show/${sid}/games?page=make&then=start&couch=${fx.couchId}`);
  await page.locator("[data-gallery=gallery]").waitFor({ timeout: 30000 }).catch(() => {});
  check((await page.locator("[data-gallery=gallery]").count()) === 1, "Make it a game, chained: once the show's a game, Start a game opens on it");

  // The first-time tour's practice: Next through the tour to its Start a game step, the practice show, a game's Start ends in the
  // practice finish, nothing made.
  await page.goto(`${BASE}/home?tour=1`);
  await page.locator("[data-tour-go]").click({ timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 40 && !(await page.locator('[role=dialog][data-tour="start"]').count()); i++) {
    await page.locator("[role=dialog][data-tour] [data-tour-next]").first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  check((await page.locator('[role=dialog][data-tour="start"]').count()) === 1, "the tour: its Start a game step");
  await page.locator('[role=dialog][data-tour="start"][data-tour-lit="on"]').waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const ring = await page.evaluate(() => {
    const root = document.querySelector('[role="dialog"][data-tour]');
    const r = root && root.querySelector("svg rect[stroke-width]");
    if (!r) return null;
    const b = root.getBoundingClientRect();
    const n = (a) => Number(r.getAttribute(a));
    return { x: b.left + n("x") + n("width") / 2, y: b.top + n("y") + n("height") / 2 };
  });
  if (ring) await page.mouse.click(ring.x, ring.y);
  await page.locator("[data-pick-practice]").click({ timeout: 15000 }).catch(() => {});
  // The tour's step says "Make a Prediction Sheet": the practice opens on its screen, the Practice strip over it.
  await page.locator("[data-gallery=base]").waitFor({ timeout: 60000 }).catch(() => {});
  check((await page.locator("[role=dialog][data-open] [data-practice]").count()) === 1 && /Prediction sheet/i.test(await page.locator("[data-gallery-title]").innerText().catch(() => "")), "the practice: the Prediction sheet's screen with its Practice strip");
  await shot("10-practice");
  const leaguesBefore = (await leaguesNow()).length;
  await page.locator("[data-gallery-start]").first().click({ timeout: 15000 }).catch(() => {});
  await page.locator("[data-practice-done]").waitFor({ timeout: 10000 }).catch(() => {});
  check(/isn't saved/.test(await page.locator("[data-practice-done]").innerText().catch(() => "")) && (await leaguesNow()).length === leaguesBefore, "Start ends in the practice's finish: nothing made");
  await shot("11-practice-done");

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
