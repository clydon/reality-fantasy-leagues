// Bingo's bank, step 1 (docs/PLAN-bingo-bank.md; migration 0146): squares written for each episode before it airs (by our bot, or
// pasted on the desk's Bingo bank: docs/PLAN-desk-parity.md part 4c), cards dealt from the episode's bank, else the season's, else
// none, by likelihood (three likely, four maybe, one long shot), two rerolls before your first tick, and a bank's square settled by
// the couch saying so.
//
//   API: no bank, no card; the desk's Paste squares questions (/api/desk/seasons/[id]/bingo/question: the episode's, with when it
//        airs, who's still in, the scoring moments to leave out; the season's, nobody named; a finale's lean) and who may read them;
//        pastes (/api/desk/seasons/[id]/bingo) refused (no JSON, too few fitting, nothing pasted) and filed (dropped squares with
//        why, read back from the bank's page); the season's bank, then the episode's own; the mix on every card; rerolls (stable,
//        the last, refused, the count kept through a new bank); Episode 5 on an eight-square bank (so every card has the same
//        squares): an untick that keeps nothing, a first tick keeping the card, no reroll after, two on the couch settling a square,
//        a line; a new bank leaving kept cards alone and dealing the rest afresh.
//   Browser (390): the desk's admin pastes Episode 7's squares on the desk's Bingo bank (/desk/season/<id>/bingo: none of its own,
//        Paste squares, what it keeps and leaves out, saved, the tiers with what was dropped); jordan's Episode 6 card: New card,
//        the are-you-sure, Keep this one, Deal a new card twice, none left; alex's Episode 5 card once he's seen it, settled by the
//        couch.
//   Calling BINGO (step 3): a line made isn't counted until called (refusals: not all ticked, not a line, before airtime, no card,
//        a card from before the banks); calling twice changes nothing; unticking takes the call back; the notice to the couch
//        (who hears, who doesn't, once); Did it? (whose list, sam refused before he's seen it, bad says, a square settling yes, two
//        no's taking a line off, a say taken back, then counting); their card (seen, behind, watching together, 404s). In the
//        browser: jordan's Sure all three happened?, Undo, Call BINGO; alex opening the notice's link to jordan's card and
//        answering Did it?; sam told to catch up first.
//   Flags (step 4): refusals, your flag taking a square off your own card (not ticked) at once and back, one flag leaving it in
//        everyone else's, two taking it out of new cards, a ticked card keeping it, a square whose bank was written again, the
//        desk's Hide it and Show it again (and a player refused); the couch feed's BINGO line (alex's, not sam's). In the browser:
//        alex's Tonight row asking Did it happen?, riley flagging a square and undoing it from the toast, the desk's admin hiding one
//        on the Bingo bank and showing it again.
//   The bot (step 2, db/bot-research.js's bingo run), with stand-ins and never ChatGPT: the planner on a test clock (nothing an hour
//        before, Episode 6's squares a day before it airs, then the season's own while it has none, nothing once an episode airs),
//        the scheduled runs through runNext for this season only (the squares written then checked in a second ask, the check's
//        drops with why, filed with the run; the season's own naming nobody; a check passing 15 fails and leaves no bank, retried
//        20 minutes on; a short answer fails before the check; an episode written by hand left as it is, without asking), then the
//        desk's Run now (POST /api/desk/seasons/[id]/runs, kind bingo: queued, then asked) through fake-bot.js (an episode not aired
//        yet, the season's own, the run in Research's runs and its squares on the bank's page, the refusals), and in the browser at
//        390 the desk's admin tapping Write them now on Episode 11's bank.
//
//   node scripts/dev-test/check-bingo-bank.js <outDir> [--width=390] [--keep] [--api]
//
// Needs `npm run dev`. The bot's half switches bot research on for the fixture's season only while its planner runs, and off
// again; the cron route is never called (it plans every season). Brings new-fixture.js up (ZT Survivor 51: Episode 6 in three days, alex/riley/jordan on 5, sam on 3) with
// its own admin, zt_nd_desk (fixture.down removes zt_nd_ people), and banks filed with bingo-fixture.js; takes it all down unless
// --keep. Touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const bingo = require("./bingo-fixture");
const fakeBot = require("./fake-bot");
const Bot = require("../../db/bot-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-bingo-bank runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-bingo-bank.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;
const DESK = u("desk");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/**
 * A stand-in for the bot's bingo run: thirty squares and two the parse drops (a question, a scoring moment), plus `extra`; or
 * (`short`) ten. The check passes every square but those `fail` names, by their number in its list. `ask` is runJob's way in,
 * `reply` fake-bot.js's; `asked` keeps every prompt.
 */
function bingoBot({ extra = [], fail = {}, short = false } = {}) {
  const asked = [];
  const reply = (prompt) => {
    asked.push(prompt);
    if (/These are bingo squares for people watching/.test(prompt)) {
      const n = (prompt.match(/^\d+\. /gm) || []).length;
      const checks = Array.from({ length: n }, (_, i) => ({ n: i + 1, seen: true, likely: true, scoring: false, spoiler: false, sameAs: null, likelihood: null, note: "", ...(fail[i + 1] || {}) }));
      return "```json\n" + JSON.stringify({ checks }) + "\n```";
    }
    const list = short
      ? bingo.squares({ likely: 4, maybe: 4, longshot: 2 })
      : [...bingo.squares({ likely: 10, maybe: 14, longshot: 6 }), { square: "Will it rain?", likelihood: "maybe" }, { square: "Voted out", likelihood: "likely" }, ...extra];
    return bingo.answer(list);
  };
  return { asked, reply, ask: async (prompt) => ({ answer: reply(prompt) }) };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    // The fixture files an eight-square season bank for every check's cards: this one starts with none.
    await bingo.down(pool, sid);
    const A = fx.couchId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`,
      [deskId, DESK, `${DESK}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(U), deskId]]);

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "desk"]) as[who] = await api({ user: u(who), pass: PASSWORD });
    const q = `?couch=${A}`;
    const card = (who, n) => as[who].call("GET", `/api/seasons/${sid}/bingo/${n}${q}`);
    const tick = (who, n, square, ticked = true) => as[who].call("POST", `/api/seasons/${sid}/bingo/${n}${q}`, { square, ticked });
    const reroll = (who, n) => as[who].call("POST", `/api/seasons/${sid}/bingo/${n}${q}`, { reroll: true });
    const callIt = (who, n, line) => as[who].call("POST", `/api/seasons/${sid}/bingo/${n}${q}`, { call: line });
    const sayIt = (who, n, said) => as[who].call("POST", `/api/seasons/${sid}/bingo/${n}${q}`, { said });
    const theirs = (who, n, of, couch = A) => as[who].call("GET", `/api/seasons/${sid}/bingo/${n}?couch=${couch}&of=${of}`);
    const calledRow = async (who, n) => (await pool.query("SELECT called_lines FROM bingo_cards WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], sid, n])).rows[0]?.called_lines ?? [];
    /** The BINGO notice `who` was told of `of`'s call (it's kept after the answer goes, so wait a moment), or null. */
    const told = async (who, of, n, ms = 8000) => {
      const until = Date.now() + ms;
      for (;;) {
        const { rows } = await pool.query("SELECT title, body, link FROM notifications WHERE user_id = $1 AND key = $2", [U[who], `bingo:${sid}:${n}:${U[of]}`]);
        if (rows[0] || Date.now() > until) return rows[0] ?? null;
        await new Promise((res) => setTimeout(res, 300));
      }
    };
    // The desk's Bingo bank (desk-bingo.ts): a bank is an episode's number or "season".
    const BANK = `/api/desk/seasons/${sid}/bingo`;
    const question = (bank) => as.desk.call("GET", `${BANK}/question?bank=${bank}`);
    const bankPage = async (bank) => (await as.desk.call("GET", `${BANK}?bank=${bank}`)).body;
    const paste = (bank, answer) => as.desk.call("POST", BANK, { bank, paste: answer });
    const dealsFrom = (page, bank) => page.strip.find((s) => s.bank === bank)?.squares ?? null;
    const liveOf = async (episode) =>
      (await pool.query("SELECT id, likelihood FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 AND status = 'live'", [sid, episode])).rows.map((r) => ({
        key: `b:${r.id}`,
        likelihood: r.likelihood,
      }));
    const keysOf = (body) => body.squares.filter((s) => s.key !== "free").map((s) => s.key);
    const within = (body, bank) => keysOf(body).length > 0 && keysOf(body).every((k) => bank.some((s) => s.key === k));
    const mixOf = (body, bank) => {
      const m = { likely: 0, maybe: 0, longshot: 0 };
      for (const k of keysOf(body)) m[bank.find((s) => s.key === k)?.likelihood ?? "none"]++;
      return JSON.stringify(m);
    };
    const MIX = JSON.stringify({ likely: 3, maybe: 4, longshot: 1 });
    const cardRow = async (who, n) => (await pool.query("SELECT c.rerolls, (SELECT count(*)::int FROM bingo_marks m WHERE m.card_id = c.id) AS marks FROM bingo_cards c WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], sid, n])).rows[0] ?? null;
    const at = (body, key) => body.squares.findIndex((s) => s.key === key);

    // ---------- no bank: no card ----------
    let r = await card("alex", 6);
    check(r.status === 200 && r.body.status === "none" && r.body.squares.length === 0 && r.body.rerollsLeft === 0, "no bank yet: no card for Episode 6", JSON.stringify(r.body).slice(0, 200));
    r = await reroll("alex", 6);
    check(r.status === 409 && /No bingo card for Episode 6/.test(r.body.error), "and no new card to deal: 409", JSON.stringify(r.body));
    r = await tick("alex", 5, 0);
    check(r.status === 409 && /No bingo card for Episode 5/.test(r.body.error), "nothing to tick on Episode 5: 409", JSON.stringify(r.body));

    // ---------- the desk's Paste squares questions ----------
    r = await as.alex.call("GET", `${BANK}/question?bank=6`);
    check(r.status === 403 && (await as.alex.call("GET", `${BANK}?bank=6`)).status === 403, "a player can't read the bank or its question: 403");
    let page = await bankPage(6);
    check(page.sel === 6 && page.bank === null && dealsFrom(page, 6) === null && dealsFrom(page, "season") === null, "the desk's Episode 6: no squares yet, nothing to deal from", JSON.stringify(page.strip));
    r = await question(6);
    const P = r.body.prompt ?? "";
    check(/ZT Survivor season 51\. Episode 6 airs .+\. It hasn't aired yet\./.test(P), "the episode's prompt: the show, the episode, when it airs", P.split("\n")[0]);
    check(P.includes("Cristian Chavez") && !P.includes("Aaliyah Puglia"), "who's still in, by name, and not who's gone");
    check(P.includes("Sat out a challenge") && P.includes("2nd in the Immunity challenge") && /Write 30 squares/.test(P), "the scoring moments, to leave out; thirty squares");
    r = await question("season");
    check(/any regular episode of it/.test(r.body.prompt) && !r.body.prompt.includes("Cristian Chavez") && /no names/.test(r.body.prompt), "the season's prompt: any regular episode, nobody named");
    r = await question(13);
    check(/It's the finale\./.test(r.body.prompt), "Episode 13's prompt leans to the finale");
    r = await question("middle");
    check(r.status === 400, "a bank that's neither: 400");

    // ---------- pasting: refused, then the season's bank ----------
    r = await paste(6, "Sorry, I can't search the web right now.");
    check(r.status === 400 && /no JSON/.test(r.body.error), "an answer with no JSON: 400", JSON.stringify(r.body));
    r = await paste(6, bingo.answer(bingo.squares({ likely: 3, maybe: 3 })));
    check(r.status === 400 && /Only 6 of 6 squares fit: a bank needs at least 8/.test(r.body.error), "six squares: too few for a bank, 400", JSON.stringify(r.body));
    r = await paste(6, " ");
    check(r.status === 400 && /Paste/.test(r.body.error), "nothing pasted: 400");
    r = await as.alex.call("POST", BANK, { bank: 6, paste: bingo.answer(bingo.squares({ likely: 8 })) });
    check(r.status === 403, "a player can't file a bank: 403");
    check((await liveOf(6)).length === 0 && (await liveOf(null)).length === 0, "and nothing was filed");
    const seasonAnswer = [
      ...bingo.squares({ likely: 8, maybe: 8, longshot: 4 }),
      { square: "Does anyone cry?", likelihood: "maybe" },
      { square: "Sat out a challenge", likelihood: "likely" },
      { square: "Cristian builds a fire", likelihood: "maybe" },
    ];
    r = await paste("season", bingo.answer(seasonAnswer));
    page = await bankPage("season");
    const notes = (page.bank?.squares ?? []).filter((s) => s.state === "dropped").map((s) => s.note);
    check(
      r.status === 200 && r.body.text === "Saved · 20 squares for the season" && page.bank?.check === "20 pasted, not checked" && notes.length === 3 && dealsFrom(page, 6) === null && dealsFrom(page, "season") === 20,
      "the season's bank: 20 squares filed, 3 dropped; Episode 6 deals from it",
      JSON.stringify({ status: r.status, text: r.body.text, check: page.bank?.check, strip: page.strip })
    );
    check(
      notes.includes("a question, not something you see") && notes.includes("one of the show's scoring moments") && notes.includes("names someone (the season's squares name nobody)"),
      "each dropped with why: a question, a scoring moment, a name",
      notes.join(" | ")
    );
    const seasonBank = await liveOf(null);
    r = await card("alex", 6);
    check(r.body.status === "ready" && within(r.body, seasonBank) && r.body.rerollsLeft === 2 && r.body.by === "couch" && r.body.squares[4].key === "free", "alex's Episode 6 card: ready, from the season's bank, two new cards to deal", JSON.stringify(r.body).slice(0, 200));
    check(mixOf(r.body, seasonBank) === MIX, "three likely, four maybe, one long shot", mixOf(r.body, seasonBank));
    r = await card("alex", 5);
    check(r.body.status === "open" && within(r.body, seasonBank), "Episode 5 (aired, no bank of its own): the season's too");

    // ---------- the episode's own bank ----------
    const episodeAnswer = [
      ...bingo.squares({ likely: 10, maybe: 14, longshot: 6 }),
      { square: "Cristian builds a fire", likelihood: "maybe" },
      { square: "Danny tells a story", likelihood: "maybe" },
      { square: "Devin goes for a swim", likelihood: "likely" },
      { square: "Eric does push-ups", likelihood: "maybe" },
    ];
    r = await paste(6, bingo.answer(episodeAnswer));
    page = await bankPage(6);
    const dropped6 = (page.bank?.squares ?? []).filter((s) => s.state === "dropped");
    check(r.status === 200 && r.body.text === "Saved · 33 squares for Episode 6" && dropped6.length === 1 && dealsFrom(page, 6) === 33, "Episode 6's own bank: 33 filed, the 4th square naming someone dropped", JSON.stringify({ text: r.body.text, dropped: dropped6.length, strip: page.strip }));
    check(dropped6[0]?.note === "more than 3 squares name someone", "dropped: more than 3 squares name someone");
    let ep6 = await liveOf(6);
    const first6 = (await card("alex", 6)).body;
    check(within(first6, ep6) && mixOf(first6, ep6) === MIX, "alex's card now comes from Episode 6's bank, the same mix", mixOf(first6, ep6));
    for (const who of ["riley", "jordan", "sam"]) {
      const b = (await card(who, 6)).body;
      check(within(b, ep6) && mixOf(b, ep6) === MIX && JSON.stringify(b.squares) !== JSON.stringify(first6.squares), `${who}'s card: their own, the same mix`, mixOf(b, ep6));
    }
    check(JSON.stringify((await card("alex", 6)).body.squares) === JSON.stringify(first6.squares), "dealt the same way twice");
    check(within((await card("alex", 5)).body, seasonBank), "Episode 5 still deals from the season's");
    check(!(await cardRow("alex", 6)), "nothing kept: no card row until a tick or a new card");

    // ---------- rerolls ----------
    r = await reroll("alex", 6);
    const second6 = r.body;
    check(r.status === 200 && second6.rerollsLeft === 1 && JSON.stringify(second6.squares) !== JSON.stringify(first6.squares) && within(second6, ep6) && mixOf(second6, ep6) === MIX, "New card: a different card, the same mix, one left", JSON.stringify({ status: r.status, left: second6.rerollsLeft }));
    check(JSON.stringify((await card("alex", 6)).body.squares) === JSON.stringify(second6.squares), "the new card holds on every read");
    let row = await cardRow("alex", 6);
    check(row?.rerolls === 1 && row.marks === 0, "kept as a count: 1 reroll, no ticks", JSON.stringify(row));
    r = await reroll("alex", 6);
    check(r.status === 200 && r.body.rerollsLeft === 0 && JSON.stringify(r.body.squares) !== JSON.stringify(second6.squares), "the last new card");
    r = await reroll("alex", 6);
    check(r.status === 409 && /No new cards left/.test(r.body.error), "a third: 409", JSON.stringify(r.body));
    await bingo.up(pool, sid, 6, bingo.squares({ likely: 12, maybe: 16, longshot: 2 }));
    ep6 = await liveOf(6);
    r = await card("alex", 6);
    check(within(r.body, ep6) && r.body.rerollsLeft === 0, "a new bank deals his card afresh; his rerolls stay used", JSON.stringify({ left: r.body.rerollsLeft }));

    // ---------- Episode 5: ticks, a card kept, the couch settling ----------
    // Eight squares: every card has all of them, each in its own place, so two people can tick the same one.
    const ep5 = await bingo.up(pool, sid, 5, bingo.squares({ likely: 3, maybe: 4, longshot: 1 }));
    const a5 = (await card("alex", 5)).body;
    check(
      a5.status === "open" && keysOf(a5).sort().join() === ep5.map((s) => s.key).sort().join() && Array.isArray(a5.truth) && a5.truth[4] === "yes" && a5.truth.filter((t) => t === null).length === 8 && a5.by === "couch" && !a5.alone,
      "Episode 5's own eight-square bank: all eight on alex's card, nothing settled yet, the couch settles it",
      JSON.stringify({ truth: a5.truth, by: a5.by, alone: a5.alone })
    );
    const r5 = (await card("riley", 5)).body;
    r = await tick("riley", 5, r5.squares[0].key === "free" ? 1 : 0, false);
    check(r.status === 200 && !(await cardRow("riley", 5)), "riley unticks a square on a card she hasn't kept: nothing kept");
    const K3 = a5.squares[3].key;
    const K5 = a5.squares[5].key;
    r = await tick("alex", 5, 3);
    row = await cardRow("alex", 5);
    check(r.status === 200 && r.body.ticked.join() === "3" && row?.marks === 1 && r.body.rerollsLeft === 0 && r.body.truth[3] === null, "alex's first tick keeps his card; one say isn't enough", JSON.stringify({ ticked: r.body.ticked, truth: r.body.truth?.[3], row }));
    r = await reroll("alex", 5);
    check(r.status === 409 && /ticked this card/.test(r.body.error), "no new card once you've ticked: 409", JSON.stringify(r.body));
    r = await tick("alex", 5, 5);
    check(r.body.calls && r.body.lines.ticked === 1 && r.body.lines.called === 0 && r.body.lines.waiting === 0 && r.body.lines.standing === 0, "his row through the centre: a line made, not his until he calls it", JSON.stringify(r.body.lines));
    r = await callIt("alex", 5, 1);
    check(r.status === 200 && r.body.called.length === 1 && r.body.called[0].line === 1 && r.body.lines.called === 1 && r.body.lines.waiting === 1, "he calls BINGO on it: called, waiting on the couch", JSON.stringify({ called: r.body.called, lines: r.body.lines }));
    await tick("riley", 5, at(r5, K3));
    await tick("riley", 5, at(r5, K5));
    r = await card("alex", 5);
    check(r.body.truth[3] === "yes" && r.body.truth[5] === "yes" && r.body.lines.standing === 1 && r.body.lines.waiting === 0, "riley ticks the same two: two say so, his line counts", JSON.stringify({ truth: r.body.truth, lines: r.body.lines }));
    check(r.body.people.some((p) => p.name === u("riley")) && r.body.first?.userId === U.alex, "the couch's cards, and alex got a line first", JSON.stringify({ people: r.body.people, first: r.body.first }));
    const new5 = await bingo.up(pool, sid, 5, [...bingo.squares({ likely: 4, maybe: 4 })].reverse());
    r = await card("alex", 5);
    check(JSON.stringify(r.body.squares) === JSON.stringify(a5.squares) && r.body.lines.standing === 1, "a new bank: alex's kept card stays as dealt, his line still counts");
    check(within((await card("jordan", 5)).body, new5), "jordan's (never ticked) is dealt from the new bank");

    // ================= calling BINGO, "Did it?" and their cards (step 3) =================
    r = await callIt("alex", 5, 0);
    check(r.status === 409 && /Tick all three squares of that line first/.test(r.body.error), "calling a line not all ticked: 409", JSON.stringify(r.body));
    r = await callIt("alex", 5, 8);
    check(r.status === 400, "a line that isn't one: 400");
    r = await callIt("alex", 6, 1);
    check(r.status === 409 && /opens when Episode 6 starts/.test(r.body.error), "before airtime: 409", JSON.stringify(r.body));
    r = await callIt("jordan", 5, 1);
    check(r.status === 409 && /Tick the line's three squares first/.test(r.body.error), "no card kept yet: 409", JSON.stringify(r.body));
    r = await callIt("alex", 5, 1);
    check(r.status === 200 && r.body.called.length === 1 && (await calledRow("alex", 5)).length === 1, "calling a line already called changes nothing");

    // riley's own line: through the centre on her card, its two squares ones alex hasn't ticked, so they wait on a say.
    const rc = (await card("riley", 5)).body;
    const through = [[1, 7, 4], [3, 5, 1], [0, 8, 6], [2, 6, 7]]; // [a, b, its line in LINES]
    const [ra, rb, rLine] = through.find(([a, b]) => ![K3, K5].includes(rc.squares[a].key) && ![K3, K5].includes(rc.squares[b].key));
    const RA = rc.squares[ra].key;
    const RB = rc.squares[rb].key;
    await tick("riley", 5, ra);
    r = await tick("riley", 5, rb);
    check(r.body.lines.ticked >= 1 && !r.body.called.some((c) => c.line === rLine), "riley ticks a line: made, not called", JSON.stringify(r.body.called));
    r = await callIt("riley", 5, rLine);
    check(r.status === 200 && r.body.called.some((c) => c.line === rLine), "riley calls BINGO on it");
    r = await tick("riley", 5, rb, false);
    check(!r.body.called.some((c) => c.line === rLine) && !(await calledRow("riley", 5)).some((c) => c.line === rLine), "she unticks one of its squares: the call comes off", JSON.stringify(await calledRow("riley", 5)));
    await tick("riley", 5, rb);
    r = await callIt("riley", 5, rLine);
    check(r.body.called.some((c) => c.line === rLine), "ticked and called again");
    const note = await told("alex", "riley", 5);
    check(
      !!note && note.title === `${u("riley")} called BINGO` && note.body === "ZT Survivor 51 · Episode 5 · Look at their card" && note.link === `/show/${sid}/tonight?bingo=5&of=${U.riley}`,
      "alex hears: zt_nd_riley called BINGO · Look at their card",
      JSON.stringify(note)
    );
    check(!!(await told("jordan", "riley", 5, 3000)), "jordan (has seen it, no card) hears too");
    check(!(await told("sam", "riley", 5, 1500)) && !(await told("riley", "riley", 5, 500)), "sam (on 3, no card on it) doesn't, nor riley herself");
    check((await pool.query("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND key = $2", [U.alex, `bingo:${sid}:5:${U.riley}`])).rows[0].n === 1, "told once, though she called it twice");

    // Did it? alex and jordan answer riley's two squares.
    const item = (b, key) => b.didIt.find((x) => x.key === key);
    let ab = (await card("alex", 5)).body;
    check(item(ab, RA)?.by.join() === u("riley") && item(ab, RA).mine === null && !!item(ab, RB) && !ab.didIt.some((x) => [K3, K5].includes(x.key)), "alex's Did it?: riley's two squares (not those already settled)", JSON.stringify(ab.didIt));
    check(!(await card("riley", 5)).body.didIt.some((x) => [RA, RB].includes(x.key)), "riley doesn't answer her own");
    check((await card("sam", 5)).body.didIt.length === 0, "sam (on 3): nothing to say yet");
    r = await sayIt("sam", 5, { [RA]: "yes" });
    check(r.status === 403 && /See Episode 5 first/.test(r.body.error), "sam can't say: 403", JSON.stringify(r.body));
    for (const [said, what] of [
      [{}, "nothing said"],
      [{ "b:nope": "yes" }, "not a square"],
      [{ [`b:${crypto.randomUUID()}`]: "yes" }, "a square on nobody's card for the episode"],
      [{ [RA]: "maybe" }, "maybe isn't a say"],
    ]) {
      r = await sayIt("alex", 5, said);
      check(r.status === 400, `${what}: 400`, JSON.stringify(r.body));
    }
    r = await sayIt("alex", 5, { [RA]: "yes" });
    check(r.status === 200 && !item(r.body, RA) && !!item(r.body, RB), "alex says the first happened: settled, gone from his list; the second waits", JSON.stringify(r.body).slice(0, 300));
    let rr = (await card("riley", 5)).body;
    check(rr.truth[ra] === "yes" && rr.truth[rb] === null && rr.lines.waiting >= 1, "riley's line waits on its second square", JSON.stringify(rr.lines));
    await sayIt("alex", 5, { [RB]: "no" });
    await sayIt("jordan", 5, { [RB]: "no" });
    rr = (await card("riley", 5)).body;
    check(rr.truth[rb] === "no" && rr.lines.off === 1, "alex and jordan say the second didn't: her line came off", JSON.stringify(rr.lines));
    r = await sayIt("alex", 5, { [RB]: null });
    rr = (await card("riley", 5)).body;
    check(item(r.body, RB)?.mine === null && rr.truth[rb] === null && rr.lines.off === 0, "alex takes his say back: it waits again");
    await sayIt("alex", 5, { [RB]: "yes" });
    rr = (await card("riley", 5)).body;
    check(rr.truth[rb] === "yes" && rr.lines.standing === 1 && rr.lines.off === 0, "then says it did: two yes to one no, her line counts", JSON.stringify(rr.lines));

    // Their card: once you've seen it, or watching it together; else who, and the episode to catch up on.
    r = await theirs("alex", 5, U.riley);
    check(
      r.status === 200 && r.body.of?.name === u("riley") && r.body.squares.length === 9 && r.body.called.some((c) => c.line === rLine) && Array.isArray(r.body.truth) && r.body.rerollsLeft === 0,
      "alex looks at riley's card: her squares, ticks and called line, how each stands",
      JSON.stringify(r.body).slice(0, 200)
    );
    r = await theirs("sam", 5, U.riley);
    check(r.status === 200 && r.body.squares.length === 0 && r.body.ticked.length === 0 && r.body.catchUp === 5 && r.body.of?.name === u("riley"), "sam (on 3): only who, and the episode to catch up on", JSON.stringify(r.body).slice(0, 200));
    // A together session is a planned night's (watch_plans), on the couch.
    const plan = (await pool.query("INSERT INTO watch_plans (couch_id, season_id, episode, how, starts_at, created_by) VALUES ($1, $2, 5, 'start', now(), $3) RETURNING id", [A, sid, U.riley])).rows[0].id;
    const ws = (await pool.query("INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, together, plan_id, mode) VALUES ($1, 5, $2, $3, true, $4, 'stream') RETURNING id", [sid, A, U.riley, plan])).rows[0].id;
    await pool.query("INSERT INTO watch_session_people (session_id, user_id) VALUES ($1, $2), ($1, $3)", [ws, U.riley, U.sam]);
    r = await theirs("sam", 5, U.riley);
    check(r.body.squares.length === 9 && r.body.truth === null && r.body.didIt.length === 0, "watching it together: sam sees her card, nothing of how it went");
    await pool.query("DELETE FROM watch_plans WHERE id = $1", [plan]);
    r = await theirs("alex", 5, U.jordan);
    check(r.status === 404, "someone who hasn't played it: 404");
    r = await theirs("alex", 5, U.riley, fx.extraCouchId);
    check(r.status === 404, "on a couch she isn't on: 404");

    // A card from before the banks: its ticked lines are its own, nothing to call.
    const old = Array.from({ length: 9 }, (_, i) => (i === 4 ? { key: "free", label: "Free" } : { key: `m:zt${i}`, label: `Moment ${i}` }));
    const oldCard = (await pool.query("INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, 4, $3) RETURNING id", [U.jordan, sid, JSON.stringify(old)])).rows[0].id;
    await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, 3), ($1, 5)", [oldCard]);
    r = await card("jordan", 4);
    check(r.body.calls === false && r.body.lines.ticked === 1 && r.body.lines.called === 1 && r.body.by === "results", "a card from before the banks: its ticked line is its own, no call", JSON.stringify(r.body.lines));
    r = await callIt("jordan", 4, 1);
    check(r.status === 400 && /count by themselves/.test(r.body.error), "and nothing to call: 400", JSON.stringify(r.body));

    // The couch feed (step 3's leftover): riley's call is a line on alex's hub, not on sam's (on 3, no card on Episode 5).
    const feedOf = async (who) => (await as[who].call("GET", `/api/couches/${A}/hub`)).body.feed ?? [];
    const rileyCall = (await feedOf("alex")).find((e) => e.kind === "bingo" && e.userId === U.riley);
    check(rileyCall?.episode === 5 && rileyCall.seasonId === sid && /ZT Survivor/.test(rileyCall.label), "alex's couch feed: riley called BINGO on Episode 5", JSON.stringify(rileyCall ?? null));
    check(!(await feedOf("sam")).some((e) => e.kind === "bingo"), "sam's (on 3, no card on it): no BINGO line");

    // ================= "This square's unfair" (step 4) =================
    const flagIt = (who, n, key, on = true) => as[who].call("POST", `/api/seasons/${sid}/bingo/${n}${q}`, { flag: key, on });
    const flagsOn = async (key) => (await pool.query("SELECT count(*)::int AS n FROM bingo_square_flags WHERE square_id = $1", [key.slice(2)])).rows[0].n;
    // The square as the desk's bank lists it: players' flags (an admin's hide isn't one), and its state.
    const adminSquare = async (key) => (await bankPage(6)).bank?.squares.find((s) => s.id === key.slice(2));
    ep6 = await liveOf(6);
    const s6 = (await card("sam", 6)).body;
    const X = keysOf(s6)[0];
    const notSams = ep6.find((s) => !keysOf(s6).includes(s.key)).key;
    r = await flagIt("sam", 6, "b:nope");
    check(r.status === 400, "flagging something that isn't a square: 400");
    r = await flagIt("sam", 6, notSams);
    check(r.status === 400 && /isn't on your card/.test(r.body.error), "a square not on your card: 400", JSON.stringify(r.body));
    r = await as.sam.call("POST", `/api/seasons/${sid}/bingo/6${q}`, { flag: X, on: "yes" });
    check(r.status === 400, "on must be true or false: 400");
    r = await flagIt("sam", 6, X);
    check(r.status === 200 && !keysOf(r.body).includes(X) && within(r.body, ep6) && (await flagsOn(X)) === 1, "sam flags a square on his card (not ticked): it's off his card at once", JSON.stringify(keysOf(r.body)));
    let sq = await adminSquare(X);
    check(sq?.flags.length === 1 && sq.state === "live", "one flag: still in everyone else's new cards", JSON.stringify(sq));
    r = await flagIt("sam", 6, X, false);
    check(r.status === 200 && JSON.stringify(r.body.squares) === JSON.stringify(s6.squares) && (await flagsOn(X)) === 0, "he takes it back (off his card, still his to take back): the card he had");
    // Two people: a square on two cards.
    const pairsOf = [["riley", "jordan"], ["riley", "alex"], ["jordan", "alex"]];
    let two = null;
    for (const [p1, p2] of pairsOf) {
      const k1 = keysOf((await card(p1, 6)).body);
      const shared = keysOf((await card(p2, 6)).body).find((k) => k1.includes(k));
      if (shared) {
        two = { p1, p2, key: shared };
        break;
      }
    }
    check(!!two, "two cards share a square to flag", "no overlap found");
    if (two) {
      await flagIt(two.p1, 6, two.key);
      check(keysOf((await card(two.p2, 6)).body).includes(two.key), `one flag (${two.p1}'s): still on ${two.p2}'s card`);
      await flagIt(two.p2, 6, two.key);
      sq = await adminSquare(two.key);
      check(sq?.flags.length === 2 && sq.state === "flagged", "a second flag: out of new cards", JSON.stringify(sq));
      check(!keysOf((await card("sam", 6)).body).includes(two.key) && within((await card("sam", 6)).body, ep6.filter((s) => s.key !== two.key)), "sam's card is dealt without it");
    }
    // A card already ticked keeps a square, flagged or not.
    const j5 = (await card("jordan", 5)).body;
    await tick("jordan", 5, 0);
    const Z = j5.squares[1].key;
    r = await flagIt("jordan", 5, Z);
    check(r.status === 200 && JSON.stringify(r.body.squares) === JSON.stringify(j5.squares) && r.body.flagged.includes(Z), "jordan's card is ticked: the square he flags stays on it", JSON.stringify(r.body.flagged));
    await flagIt("jordan", 5, Z, false);
    await tick("jordan", 5, 0, false);
    r = await flagIt("alex", 5, a5.squares[0].key === "free" ? a5.squares[1].key : a5.squares[0].key);
    check(r.status === 409 && /written again/.test(r.body.error), "a square on a kept card whose bank was written again: nothing to flag (409)", JSON.stringify(r.body));
    // The desk's Hide it: out of new cards at once; Show it again: back.
    const H = keysOf((await card("riley", 6)).body).find((k) => k !== two?.key);
    r = await as.desk.call("POST", BANK, { square: H.slice(2), hide: true });
    sq = await adminSquare(H);
    check(r.status === 200 && r.body.text === "Hidden · out of new cards" && sq?.state === "hidden" && sq.hiddenBy === "you" && sq.flags.length === 0, "the desk hides a square: hidden by you, out of new cards", JSON.stringify({ r: r.body, sq }));
    check(!keysOf((await card("riley", 6)).body).includes(H), "riley's card (not ticked) is dealt without it");
    r = await as.desk.call("POST", BANK, { square: H.slice(2), hide: false });
    check(r.status === 200 && (await adminSquare(H))?.state === "live" && keysOf((await card("riley", 6)).body).includes(H), "Show it again: back in her deal", JSON.stringify(r.body));
    r = await as.alex.call("POST", BANK, { square: H.slice(2), hide: true });
    check(r.status === 403, "a player can't hide one: 403");

    // ================= the browser =================
    const noBadge = () => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    };
    let n = 0;
    const browse = async (who, headers) => {
      const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off", headers });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      let favicon = 0;
      b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
      const pg = b.page;
      return {
        pg,
        shot: async (name, full = false) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`), fullPage: full });
        },
        wide: async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
        },
        errors: () => b.errors.filter((x) => !/Failed to load resource/.test(x)).concat(b.errors.filter((x) => /Failed to load resource/.test(x)).slice(favicon)),
        close: b.close,
      };
    };

    if (!apiOnly) {
      // ---------- the desk's admin pastes Episode 7's squares on the Bingo bank ----------
      const D = await browse("desk");
      const dp = D.pg;
      await dp.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
      const dialog = () => dp.locator("[role=dialog][data-open]").last().innerText();
      await dp.goto(`${BASE}/desk/season/${sid}/bingo?bank=7`, { waitUntil: "load" });
      const none7 = dp.locator("[data-desk-bingo='7'] [data-bank-empty]");
      await none7.waitFor({ timeout: 30_000 });
      check(
        /No squares for Episode 7 yet/i.test(await none7.innerText()) && /its cards use the season's bank/.test(await none7.innerText()) && /20/.test(await dp.locator("[data-bank-chip='season']").innerText()),
        "the desk's Episode 7: none of its own, cards use the season's (20)",
        await none7.innerText()
      );
      await D.shot("desk-bingo");
      await dp.locator("[data-bank-paste]").click();
      await dp.locator("[data-ai-copy]").first().waitFor({ timeout: 20_000 });
      check(/Squares for Episode 7/i.test(await dialog()), "Paste squares: Ask an AI, for Episode 7", (await dialog()).slice(0, 200));
      await dp.locator("[data-ai-copy]").first().click();
      await dp.locator("[data-ai-answer]").waitFor({ timeout: 10_000 });
      await dp.locator("[data-ai-answer]").fill(bingo.answer([...bingo.squares({ likely: 10, maybe: 14, longshot: 6 }), { square: "Will it rain?", likelihood: "maybe" }, { square: "Voted out", likelihood: "likely" }]));
      await D.shot("desk-bingo-paste");
      await dp.locator("[data-ai-use]").click();
      await dp.locator("[data-moves]").waitFor({ timeout: 30_000 });
      const pre = await dialog();
      check(
        /32 squares pasted/.test(pre) && /30 fit on cards/.test(pre) && /1 a question, not something you see/.test(pre) && /1 one of the show's scoring moments/.test(pre) && !/Replaced/.test(pre),
        "what it keeps and leaves out, before it's saved",
        pre.slice(0, 400)
      );
      await D.shot("desk-bingo-preview");
      await dp.locator("[data-guard-confirm]").click();
      await dp.locator("[data-toast]", { hasText: "Saved · 30 squares for Episode 7" }).waitFor({ timeout: 20_000 });
      const line7 = dp.locator("[data-desk-bingo='7'] [data-bank-line]", { hasText: "30 pasted, not checked" });
      await line7.waitFor({ timeout: 15_000 });
      check(/You pasted them/.test(await line7.innerText()), "saved: pasted by you, 30 not checked", await line7.innerText());
      check((await dp.locator("[data-bank] [data-square-state='live']").count()) === 30 && (await dp.locator("[data-tier='out'] [data-square-state='dropped']").count()) === 2, "30 squares on cards and the 2 dropped, listed");
      await dp.locator("[data-tier='out'] [data-square-state='dropped']").first().click();
      await dp.locator("[data-square-sheet]").waitFor({ timeout: 10_000 });
      check(/Left out of the paste: (a question, not something you see|one of the show's scoring moments)\./.test(await dp.locator("[data-square-sheet]").innerText()), "a dropped one says why", await dp.locator("[data-square-sheet]").innerText());
      await dp.keyboard.press("Escape");
      check((await liveOf(7)).length === 30, "and they're in the database");
      await D.wide("the desk's Bingo bank");
      await D.shot("desk-bingo-saved");
      check(D.errors().length === 0, "no page errors (the desk, pasting)", D.errors().join(" | "));

      // ---------- jordan's Episode 6 card: New card, twice ----------
      const J = await browse("jordan");
      const jp = J.pg;
      await jp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const row6 = jp.locator('[data-bingo-row="6"]');
      await row6.waitFor({ timeout: 30_000 });
      await row6.scrollIntoViewIfNeeded();
      await row6.click();
      const sheet = jp.locator('[data-bingo-sheet="6"][data-bingo-status="ready"]');
      await sheet.waitFor({ timeout: 20_000 });
      await jp.waitForTimeout(600);
      const labels = async () => (await sheet.locator("[data-square]").allInnerTexts()).join(" | ");
      const dealt = await labels();
      const ep6Labels = new Set((await pool.query("SELECT label FROM bingo_squares WHERE season_id = $1 AND episode = 6 AND status = 'live'", [sid])).rows.map((x) => x.label));
      check((await sheet.locator("[data-square]").allInnerTexts()).filter((t) => !/^free$/i.test(t.trim())).every((t) => ep6Labels.has(t.trim())), "jordan's card: Episode 6's squares", dealt);
      const newBtn = jp.locator("[data-bingo-new]");
      check((await newBtn.getAttribute("data-bingo-new")) === "2" && /New card · 2 left/.test(await newBtn.innerText()), "New card · 2 left", await newBtn.innerText().catch(() => ""));
      await J.shot("card-ready");
      await newBtn.click();
      const sure = jp.locator("[data-bingo-sure]");
      await sure.waitFor({ timeout: 5_000 });
      check(/Sure\? You can.t get this card back/.test(await sure.innerText()) && /2 new cards left for this episode/.test(await sure.innerText()), "asked first: sure, you can't get this card back", await sure.innerText());
      await sure.scrollIntoViewIfNeeded();
      await J.shot("card-sure");
      await jp.locator("[data-bingo-keep]").click();
      await sure.waitFor({ state: "detached", timeout: 5_000 });
      check((await labels()) === dealt && (await cardRow("jordan", 6)) === null, "Keep this one: the same card, nothing dealt");
      await newBtn.click();
      await jp.locator("[data-bingo-deal]").click();
      await jp.waitForFunction((before) => [...document.querySelectorAll('[data-bingo-sheet="6"] [data-square]')].map((e) => e.textContent).join(" | ") !== before, dealt.replace(/\n/g, ""), { timeout: 10_000 }).catch(() => {});
      await jp.locator("[data-bingo-new='1']").waitFor({ timeout: 10_000 });
      const second = await labels();
      check(second !== dealt && (await cardRow("jordan", 6))?.rerolls === 1, "Deal a new card: a new card, 1 left", second);
      check(/New card · one more if you want it/.test((await jp.locator("[role=status]").allTextContents()).join(" | ")), "a toast says one more if you want it");
      await J.shot("card-new");
      await jp.locator("[data-bingo-new]").click();
      check(/It's your last new card for this episode/.test(await jp.locator("[data-bingo-sure]").innerText()), "the last one says so");
      await jp.locator("[data-bingo-deal]").click();
      // The sure panel stands in for the button, so wait for it to go: then the card's been dealt and nothing's left to tap.
      await jp.locator("[data-bingo-sure]").waitFor({ state: "detached", timeout: 10_000 });
      check(
        (await labels()) !== second && (await cardRow("jordan", 6))?.rerolls === 2 && (await jp.locator("[data-bingo-new]").count()) === 0,
        "the last new card: no button left"
      );
      check(/New card · that was your last/.test((await jp.locator("[role=status]").allTextContents()).join(" | ")), "a toast says that was the last");
      await J.wide("the bingo sheet");
      await J.shot("card-last");
      check(J.errors().length === 0, "no page errors (jordan)", J.errors().join(" | "));

      // ---------- alex's Episode 5, seen, settled by the couch ----------
      const X = await browse("alex");
      const xp = X.pg;
      await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const row5 = xp.locator('[data-bingo-row="5"]');
      await row5.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(600);
      check(/Episode 5 bingo: 1 line/.test(await row5.innerText()), "Tonight: Episode 5 bingo, 1 line", await row5.innerText());
      await row5.scrollIntoViewIfNeeded();
      await row5.click();
      const seen = xp.locator('[data-bingo-sheet="5"][data-bingo-status="seen"]');
      await seen.waitFor({ timeout: 20_000 });
      await xp.waitForTimeout(600);
      check(
        (await seen.locator('[data-square="3"][data-ticked="yes"][data-truth="yes"]').count()) === 1 && (await seen.locator('[data-square="5"][data-truth="yes"]').count()) === 1,
        "his two squares: ticked, and the couch says they happened"
      );
      check(/A square counts once two on the couch tick it or say it happened/.test(await xp.locator("[data-bingo-how]").innerText()) && (await xp.locator("[data-bingo-new]").count()) === 0, "how it settles, and no New card on a kept card", await xp.locator("[data-bingo-how]").innerText());
      await X.shot("card-seen");
      check((await seen.locator('[data-called-line="1"][data-line-state="counts"]').count()) === 1, "his called line: Counts", await seen.innerText());

      // ---------- jordan calls BINGO on Episode 5: Sure all three happened?, Undo, Call BINGO ----------
      const j5 = (await card("jordan", 5)).body;
      await tick("jordan", 5, 3);
      await jp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const jrow5 = jp.locator('[data-bingo-row="5"]');
      await jrow5.waitFor({ timeout: 30_000 });
      await jrow5.scrollIntoViewIfNeeded();
      await jrow5.click();
      const js5 = jp.locator('[data-bingo-sheet="5"]');
      await js5.waitFor({ timeout: 20_000 });
      await jp.waitForTimeout(500);
      await js5.locator('[data-square="5"]').click();
      const callPanel = jp.locator('[data-bingo-call="1"]');
      await callPanel.waitFor({ timeout: 10_000 });
      check(
        /Sure all three happened\?/.test(await callPanel.innerText()) && (await callPanel.innerText()).includes(j5.squares[3].label) && (await callPanel.innerText()).includes(j5.squares[5].label),
        "a line made: Sure all three happened?, naming its squares",
        await callPanel.innerText()
      );
      await callPanel.scrollIntoViewIfNeeded();
      await J.shot("call-sure");
      await jp.locator("[data-bingo-undo]").click();
      await callPanel.waitFor({ state: "detached", timeout: 10_000 });
      await jp.waitForFunction(() => document.querySelector('[data-bingo-sheet="5"] [data-square="5"]')?.getAttribute("data-ticked") === "no", null, { timeout: 10_000 });
      check((await calledRow("jordan", 5)).length === 0, "Undo: the last tick taken back, nothing called");
      await js5.locator('[data-square="5"]').click();
      await callPanel.waitFor({ timeout: 10_000 });
      await jp.locator("[data-bingo-callit]").click();
      await jp.locator("[data-bingo-banner]").waitFor({ timeout: 10_000 });
      await callPanel.waitFor({ state: "detached", timeout: 10_000 });
      check(/BINGO called · the couch has been told/.test((await jp.locator("[role=status]").allTextContents()).join(" | ")), "Call BINGO: Bingo!, and the couch has been told");
      check((await calledRow("jordan", 5)).some((c) => c.line === 1) && (await js5.locator('[data-called="yes"]').count()) === 2, "called, and its two squares outlined");
      await jp.waitForTimeout(1900);
      await J.shot("call-called");

      // ---------- alex opens the notice's link: Look at their card, and answers Did it? ----------
      const jnote = await told("alex", "jordan", 5);
      check(!!jnote && jnote.link === `/show/${sid}/tonight?bingo=5&of=${U.jordan}`, "alex hears zt_nd_jordan called BINGO", JSON.stringify(jnote));
      await xp.goto(`${BASE}${jnote.link}`, { waitUntil: "load" });
      const jcard = xp.locator(`[data-bingo-theirs="${U.jordan}"]`);
      await jcard.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(600);
      check(/zt_nd_jordan's Episode 5 bingo/i.test(await xp.locator("[role=dialog][data-open]").innerText()) && /zt_nd_jordan called 1 line/.test(await jcard.locator("[data-bingo-line]").innerText()), "his card: whose, and his called line", await jcard.innerText());
      check((await jcard.locator('[data-called="yes"]').count()) === 2 && (await jcard.locator("[data-square]:not([disabled])").count()) === 0, "outlined, and nothing to tick on someone else's card");
      check(new URL(xp.url()).searchParams.get("bingo") === null, "the link leaves the address bar once it's opened the card");
      const did = jcard.locator("[data-did-it]");
      check((await did.count()) === 2 && (await jcard.locator("[data-did-it-list]").innerText()).includes("zt_nd_jordan called it"), "Did it happen? his two squares, waiting on a second say", await jcard.innerText());
      await jcard.locator("[data-did-it-list]").scrollIntoViewIfNeeded();
      await X.shot("their-card");
      const firstKey = await did.first().getAttribute("data-did-it");
      await did.first().locator('[data-say="yes"]').click();
      await xp.waitForFunction((k) => !document.querySelector(`[data-did-it="${k}"]`), firstKey, { timeout: 10_000 });
      check(/Said it happened/.test((await xp.locator("[role=status]").allTextContents()).join(" | ")), "Yes: said, and with his tick that settles it (gone from the list)");
      const skipKey = await jcard.locator("[data-did-it]").first().getAttribute("data-did-it");
      await jcard.locator("[data-did-it]").first().locator('[data-say="skip"]').click();
      check((await jcard.locator("[data-did-it]").count()) === 0 && !(await pool.query("SELECT 1 FROM episode_call_says WHERE user_id = $1 AND question = $2", [U.alex, skipKey])).rows.length, "Didn't notice: put away, no say kept");
      await X.wide("someone else's card");
      await X.shot("their-card-answered");
      check(X.errors().length === 0, "no page errors (alex)", X.errors().join(" | "));

      // ---------- sam (on 3) opens the same link: catch up first ----------
      const S = await browse("sam");
      await S.pg.goto(`${BASE}${jnote.link}`, { waitUntil: "load" });
      const behind = S.pg.locator('[data-bingo-theirs="behind"]');
      await behind.waitFor({ timeout: 30_000 });
      check(/See zt_nd_jordan's card once you've caught up on Episode 5/.test(await behind.innerText()), "sam: see his card once he's caught up on Episode 5", await behind.innerText());
      await S.shot("their-card-behind");
      check(S.errors().length === 0, "no page errors (sam)", S.errors().join(" | "));

      // ---------- alex's Tonight: a nudge for the square still waiting on his say ----------
      await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const nudge = xp.locator('[data-bingo-row="5"]');
      await nudge.waitFor({ timeout: 30_000 });
      await xp.waitForTimeout(600);
      check(/Did it happen\? 1 square to say about/.test(await nudge.innerText()), "Tonight: Episode 5's row asks Did it happen? (the square he didn't notice)", await nudge.innerText());

      // ---------- riley (on 5: Episode 6 is next) flags a square on her card, and undoes it ----------
      const R = await browse("riley");
      await R.pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const rrow6 = R.pg.locator('[data-bingo-row="6"]');
      await rrow6.waitFor({ timeout: 30_000 });
      await rrow6.scrollIntoViewIfNeeded();
      await rrow6.click();
      const rs6 = R.pg.locator('[data-bingo-sheet="6"]');
      await rs6.waitFor({ timeout: 20_000 });
      await R.pg.waitForTimeout(500);
      const before6 = (await rs6.locator("[data-square]").allInnerTexts()).join(" | ");
      await R.pg.locator("[data-bingo-flag-open]").click();
      const flags = R.pg.locator("[data-bingo-flags]");
      await flags.waitFor({ timeout: 5_000 });
      check((await flags.locator("[data-flag-square]").count()) === 8 && /Yours comes off your card now/.test(await flags.innerText()), "This square's unfair: her eight squares, and her flag takes one off now");
      await flags.scrollIntoViewIfNeeded();
      await R.shot("flag-list");
      const flagged = flags.locator("[data-flag-square]").first();
      const flaggedLabel = (await flagged.locator("span").first().innerText()).trim();
      await flagged.locator('[data-flag="off"]').click();
      await R.pg.waitForFunction((t) => ![...document.querySelectorAll('[data-bingo-sheet="6"] [data-square]')].some((e) => e.textContent?.trim() === t), flaggedLabel, { timeout: 10_000 });
      check(/Flagged · a new square in its place/.test(await R.pg.locator("[role=status]").innerText()), "Flag: the square's gone from her card, a new one in its place", flaggedLabel);
      await R.shot("flagged");
      await R.pg.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      await R.pg.waitForFunction((b) => [...document.querySelectorAll('[data-bingo-sheet="6"] [data-square]')].map((e) => e.textContent).join(" | ").replace(/\s+/g, " ") === b.replace(/\s+/g, " "), before6, { timeout: 10_000 }).catch(() => {});
      check((await rs6.locator("[data-square]").allInnerTexts()).join(" | ") === before6, "Undo in the toast: the card she had");
      await R.wide("the flag list");
      check(R.errors().length === 0, "no page errors (riley, flagging)", R.errors().join(" | "));

      // ---------- the desk's admin hides a square on Episode 6, and shows it again ----------
      const AD = await browse("desk");
      await AD.pg.goto(`${BASE}/desk/season/${sid}/bingo?bank=6`, { waitUntil: "load" });
      await AD.pg.locator("[data-desk-bingo='6'] [data-bank]").waitFor({ timeout: 30_000 });
      const flaggedOut = AD.pg.locator("[data-tier='out'] [data-square-state='flagged']");
      check((await flaggedOut.count()) >= 1 && /Two flags/i.test(await flaggedOut.first().innerText()), "the desk's bank: the square two people flagged, out of new cards", await flaggedOut.first().innerText().catch(() => ""));
      const target = AD.pg.locator("[data-tier='likely'] [data-square-state='live']").first();
      const targetId = await target.getAttribute("data-square");
      await target.click();
      await AD.pg.locator("[data-square-toggle]").click({ timeout: 10_000 });
      await AD.pg.locator("[data-toast]", { hasText: "Hidden · out of new cards" }).waitFor({ timeout: 15_000 });
      const hidden = AD.pg.locator(`[data-tier='out'] [data-square='${targetId}'][data-square-state='hidden']`);
      await hidden.waitFor({ timeout: 15_000 });
      check(/Hidden by you/i.test(await hidden.innerText()), "Hide it: hidden by you, out of new cards", await hidden.innerText());
      await hidden.scrollIntoViewIfNeeded();
      await AD.shot("desk-hide");
      await hidden.click();
      await AD.pg.locator("[data-square-toggle]").click({ timeout: 10_000 });
      await AD.pg.locator("[data-toast]", { hasText: "Shown again · back on new cards" }).waitFor({ timeout: 15_000 });
      await AD.pg.locator(`[data-tier='likely'] [data-square='${targetId}'][data-square-state='live']`).waitFor({ timeout: 15_000 });
      check(true, "Show it again: back on new cards");
      await AD.wide("the desk's bank with flags");
      check(AD.errors().length === 0, "no page errors (the desk, hiding)", AD.errors().join(" | "));
      check(J.errors().length === 0, "no page errors (jordan, calling)", J.errors().join(" | "));
    }

    // ================= the bot's run (step 2) =================
    // Episode 6 and the season start with no squares, so the bot writes both (kept cards keep theirs).
    await pool.query("DELETE FROM bingo_squares WHERE season_id = $1 AND (episode = 6 OR episode IS NULL)", [sid]);
    const times = Bot.episodeAirTimes(await Bot.loadSeasonForJob(pool, sid));
    const airOf = (ep) => times.find((e) => e.episode === ep).at.getTime();
    const DAY = 24 * 60 * 60 * 1000;
    const dayBefore = (ep, minutes) => new Date(airOf(ep) - DAY + minutes * 60 * 1000);
    const slots = (plan) => plan.due.map((x) => `${x.episode}:${x.slot}${x.forSeason ? "+season" : ""}`).join();
    const rowsOf = async (episode) => (await pool.query("SELECT label, status, note, run_id FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2", [sid, episode])).rows;
    try {
      await pool.query("UPDATE show_seasons SET bot_research_on = true, bot_research_since = now() - interval '60 days', bot_research_schedule = $2 WHERE id = $1", [
        sid,
        JSON.stringify([{ kind: "bingo", after: 1440, on: true }]),
      ]);
      let plan = await Bot.planRuns(pool, { now: dayBefore(6, -60), seasonId: sid });
      check(plan.due.length === 0 && plan.next?.getTime() === dayBefore(6, 0).getTime(), "the bot's schedule: nothing an hour before, next a day before Episode 6 airs", JSON.stringify(plan));
      plan = await Bot.planRuns(pool, { now: dayBefore(6, 1), seasonId: sid });
      check(slots(plan) === "6:bingo@1440,6:bingo@season+season", "a day before: Episode 6's squares, then the season's own (it has none)", slots(plan));

      // Episode 6: thirty written, the parse drops two, the check three.
      const B1 = bingoBot({ fail: { 3: { spoiler: true }, 7: { seen: false }, 10: { sameAs: 2, note: "the same moment" } } });
      let run = await Bot.runNext(pool, { ask: B1.ask, now: dayBefore(6, 1), seasonId: sid });
      check(
        run.job?.episode === 6 && run.job.slot === "bingo@1440" && run.ok && run.message === "Episode 6's squares: 27 of 32 passed their checks",
        "the scheduled run: Episode 6's squares, 27 of 32 passed",
        JSON.stringify({ job: run.job, ok: run.ok, message: run.message })
      );
      check(
        B1.asked.length === 2 && /Write 30 bingo squares for people watching episode 6 together/.test(B1.asked[0]) && (B1.asked[1].match(/^\d+\. /gm) || []).length === 30,
        "two asks: the squares, then a check of the 30 the parse kept"
      );
      let rows = await rowsOf(6);
      const why = rows.filter((x) => x.status === "dropped").map((x) => x.note);
      check(rows.filter((x) => x.status === "live").length === 27 && rows.length === 32 && rows.every((x) => x.run_id === run.runId), "filed as Episode 6's bank, every square with its run", `${rows.length} rows`);
      check(
        ["a question, not something you see", "one of the show's scoring moments", "the check: gives something away", "the check: not something you'd see on screen"].every((w) => why.includes(w)) &&
          why.some((w) => /^the check: the same moment as ".+" \(the same moment\)$/.test(w)),
        "each dropped with why: the parse's two, the check's three",
        why.join(" | ")
      );
      check(!!run.next && run.next.getTime() - dayBefore(6, 1).getTime() < 60_000, "and the season's own is due straight after", String(run.next));
      const B2 = bingoBot({ extra: [{ square: "Cristian builds a fire", likelihood: "maybe" }] });
      run = await Bot.runNext(pool, { ask: B2.ask, now: dayBefore(6, 3), seasonId: sid });
      rows = await rowsOf(null);
      check(
        run.job?.slot === "bingo@season" && run.ok && run.message === "the season's own squares: 30 of 33 passed their checks" && run.result?.forSeason === true,
        "the next call: the season's own squares",
        JSON.stringify({ job: run.job, message: run.message })
      );
      check(/for any regular episode of it/.test(B2.asked[0]) && /for any episode of the season/.test(B2.asked[1]) && rows.filter((x) => x.status === "live").length === 30, "its prompts are the season's; 30 filed");
      check(rows.some((x) => x.note === "names someone (the season's squares name nobody)"), "the square naming someone dropped");
      plan = await Bot.planRuns(pool, { now: dayBefore(6, 5), seasonId: sid });
      check(plan.due.length === 0 && plan.next?.getTime() === dayBefore(7, 0).getTime(), "done: nothing more until a day before Episode 7", JSON.stringify(plan));
      check(within((await card("alex", 6)).body, await liveOf(6)), "alex's Episode 6 card (not ticked) is dealt from the bot's squares");

      // Episode 8: a check passing 15 fails the run and files nothing; a retry 20 minutes on; a short answer fails before the
      // check; squares written by hand in between are left as they are.
      const B3 = bingoBot({ fail: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, { likely: false, note: "rare" }])) });
      run = await Bot.runNext(pool, { ask: B3.ask, now: dayBefore(8, 1), seasonId: sid });
      check(run.job?.episode === 8 && !run.ok && run.message === "Episode 8's squares: 15 of 32 passed their checks (a bank needs 16; the squares there stay)", "15 passing: a failed try", run.message);
      check((await rowsOf(8)).length === 0 && run.result?.squares?.length === 32, "nothing filed; the run keeps what it wrote");
      // A run row keeps the real time it started; the test clock is weeks on, so give the try its time on that clock.
      await pool.query("UPDATE bot_research_runs SET started_at = $2 WHERE id = $1", [run.runId, dayBefore(8, 1)]);
      plan = await Bot.planRuns(pool, { now: dayBefore(8, 10), seasonId: sid });
      check(plan.due.length === 0 && Math.abs(plan.next.getTime() - (dayBefore(8, 1).getTime() + 20 * 60 * 1000)) < 60_000, "a retry waits 20 minutes", JSON.stringify(plan));
      const B4 = bingoBot({ short: true });
      run = await Bot.runNext(pool, { ask: B4.ask, now: dayBefore(8, 22), seasonId: sid });
      check(!run.ok && run.message === "Episode 8's squares: only 10 of 10 passed the parse (a bank needs 16)" && B4.asked.length === 1, "ten squares: failed before the check (one ask)", run.message);
      const hand = await bingo.up(pool, sid, 8, { likely: 8, maybe: 8, longshot: 4 });
      const B5 = bingoBot();
      run = await Bot.runNext(pool, { ask: B5.ask, now: dayBefore(8, 43), seasonId: sid });
      check(run.ok && run.message === "Episode 8's squares: written already, left as they are" && B5.asked.length === 0, "written by hand in between: left as they are, nobody asked", run.message);
      check((await liveOf(8)).map((x) => x.key).sort().join() === hand.map((x) => x.key).sort().join(), "the hand-written squares unchanged");
      plan = await Bot.planRuns(pool, { now: new Date(airOf(9) + 60 * 1000), seasonId: sid });
      check(!plan.due.some((x) => x.episode === 9), "Episode 9 on air: its run never comes, though it never tried", slots(plan));
    } finally {
      await pool.query("UPDATE show_seasons SET bot_research_on = false WHERE id = $1", [sid]);
    }

    // ---------- Run now, kind bingo: the desk's queue, through the stand-in bot ----------
    const B6 = bingoBot();
    const fb = await fakeBot.start({ answer: (prompt) => B6.reply(prompt) });
    closers.push(fb.close);
    const deskBot = await api({ user: DESK, pass: PASSWORD, headers: { "x-gys-bot": fb.url } });
    const runNow = (who, body) => who.call("POST", `/api/desk/seasons/${sid}/runs`, body);
    // Run now answers at once and asks after (desk-research.ts drainDeskRuns): wait for this season's queue to empty.
    const drained = async (ms = 120_000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        if (!(await pool.query("SELECT 1 FROM desk_runs WHERE season_id = $1 AND done_at IS NULL", [sid])).rows.length) return true;
        await new Promise((res) => setTimeout(res, 500));
      }
      return false;
    };
    // Research's runs (Runs' All N). The bot's scheduled tries above have test-clock start times, so find a run by what it is.
    const runsNow = async () => (await as.desk.call("GET", `/api/desk/seasons/${sid}/runs`)).body.runs ?? [];
    const byHand = (runs, episode, forSeason) => runs.find((x) => x.kind === "bingo" && x.episode === episode && x.forSeason === forSeason && /^Run now, by /.test(x.line));
    r = await runNow(deskBot, { episode: 10, kind: "bingo" });
    check(r.status === 200 && /^(Asking ChatGPT|Queued): .+, Episode 10$/.test(r.body.text), "Run now, bingo, Episode 10 (not aired yet): queued", JSON.stringify(r.body));
    check(await drained(), "it ran");
    check(fb.asked.map((x) => x.kind).join() === "bingo,bingoCheck" && (await liveOf(10)).length === 30, "the stand-in asked to write, then to check; 30 filed", fb.asked.map((x) => x.kind).join());
    let run10 = byHand(await runsNow(), 10, false);
    check(run10?.ok === true && run10.result === "Episode 10's squares: 30 of 32 passed their checks" && run10.line.startsWith(`Run now, by ${DESK} · `), "in Research's runs: Run now by the desk's admin, 30 of 32", JSON.stringify(run10 ?? null));
    page = await bankPage(10);
    check(
      page.bank?.by === "Our bot, Run now by you" && page.bank.check === "30 of 32 passed its check" && page.bank.squares.length === 32 && page.bank.squares.filter((s) => s.state === "dropped").length === 2,
      "its bank's page: every square, by our bot's Run now",
      JSON.stringify({ by: page.bank?.by, check: page.bank?.check, n: page.bank?.squares.length })
    );
    r = await runNow(deskBot, { episode: 10, kind: "bingo", scope: "season" });
    check(r.status === 200 && /the season's bank$/.test(r.body.text), "the season's own, by hand: queued", JSON.stringify(r.body));
    check(await drained(), "it ran");
    run10 = byHand(await runsNow(), 10, true);
    check(run10?.ok === true && run10.result === "the season's own squares: 30 of 32 passed their checks", "the season's own: 30 of 32", JSON.stringify(run10 ?? null));
    r = await runNow(deskBot, { episode: 5, kind: "bingo" });
    check(r.status === 400 && /Episode 5 has aired/.test(r.body.error), "an episode that has aired: 400", JSON.stringify(r.body));
    r = await runNow(deskBot, { episode: 10, kind: "quick", scope: "season" });
    check(r.status === 400 && /scope is bingo's/.test(r.body.error), "a scope on another kind: 400", JSON.stringify(r.body));
    r = await runNow(as.alex, { episode: 10, kind: "bingo" });
    check(r.status === 403, "a player can't run it: 403");

    if (!apiOnly) {
      // ---------- the desk's admin taps Write them now on Episode 11's bank ----------
      const W = await browse("desk", { "x-gys-bot": fb.url });
      const wp = W.pg;
      await wp.goto(`${BASE}/desk/season/${sid}/bingo?bank=11`, { waitUntil: "load" });
      await wp.locator("[data-desk-bingo='11'] [data-bank-empty]").waitFor({ timeout: 30_000 });
      const write = wp.locator("[data-bank-write]");
      check(/Write them now/.test(await write.innerText()), "Episode 11: none yet, Write them now");
      await W.shot("desk-bot-before");
      await write.click();
      const ep11 = wp.locator("[data-now-episode='11']");
      await ep11.waitFor({ timeout: 30_000 });
      check((await ep11.getAttribute("aria-checked")) === "true", "Run now's sheet: Bingo squares for Episode 11");
      await W.shot("desk-bot-now");
      await wp.locator("[data-now-go]").click();
      // The bank lands as it's written (the page polls while our bot writes for the season).
      const line = wp.locator("[data-desk-bingo='11'] [data-bank-line]", { hasText: "30 of 32 passed its check" });
      await line.waitFor({ timeout: 120_000 });
      check(/Our bot, Run now by you/.test(await line.innerText()), "the bank now: by our bot's Run now, 30 of 32 passed", await line.innerText());
      check(
        (await wp.locator("[data-bank] [data-square-state='live']").count()) === 30 && (await wp.locator("[data-tier='out'] [data-square-state='dropped']").count()) === 2,
        "30 squares on cards, the 2 dropped out of new cards"
      );
      await wp.locator("[data-tier='out'] [data-square-state='dropped']").first().click();
      await wp.locator("[data-square-sheet]").waitFor({ timeout: 10_000 });
      check(/Its check dropped it: (a question, not something you see|one of the show's scoring moments)\./.test(await wp.locator("[data-square-sheet]").innerText()), "a dropped one says why", await wp.locator("[data-square-sheet]").innerText());
      await wp.keyboard.press("Escape");
      await W.shot("desk-bot-written");
      check(await drained(), "and its run is done");
      const runId = (await pool.query("SELECT id FROM bot_research_runs WHERE season_id = $1 AND kind = 'bingo' AND episode_number = 11 AND slot = 'now' ORDER BY started_at DESC LIMIT 1", [sid])).rows[0]?.id;
      await wp.goto(`${BASE}/desk/season/${sid}/research`, { waitUntil: "load" });
      await wp.locator(`[data-run='${runId}']`).click({ timeout: 30_000 });
      const runRow = wp.locator("[data-desk-row='run-bingo']");
      await runRow.waitFor({ timeout: 10_000 });
      check(/Episode 11's squares/.test(await runRow.innerText()), "Research lists the run, its sheet opening Episode 11's squares", await runRow.innerText());
      await W.shot("desk-bot-run");
      await W.wide("Research with a bingo run");
      check(W.errors().length === 0, "no page errors (the desk, Write them now)", W.errors().join(" | "));
    }
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool).catch((e) => console.log(`(fixture down: ${e.message})`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exitCode = failures ? 1 : 0;
  }
})();
