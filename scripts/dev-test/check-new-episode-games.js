// Dev-only check for episode games (docs/PLAN-new-design.md step 12), against the dev server, on new-fixture.js's couch ("ZT
// Survivor 51": alex, riley, jordan and sam play it, results through Episode 5, everyone on 5 but sam on 3; ZT Traitors, which
// riley follows openly through 2 and jordan privately through 4; casey is only on alex's other couch, ZT Extra). It grows with
// the step's parts; part 1 is Rate it and the couch verdict (ratings.ts):
//   API:
//   - rating: one to five stars and a take, only for an episode you've seen (sam on 3 can't rate 4; alex can't rate 6), the
//     refusals (stars, episode, take too long or not words, a season that isn't one, a couch you're not on), a take kept when
//     only stars are sent and taken away with "", and someone who sees results straight away still can't rate what hasn't aired;
//   - one episode's verdict (GET .../ratings/[n]): the couch's (its people who follow the show openly, you first, their takes),
//     another couch's (alex and casey), everyone's with no couch (a number only, never a name), a private watcher's stars never
//     counted (jordan's Traitors), and nothing for an episode past your mark (403);
//   - the Episodes read: each episode you've seen with its verdict and your stars, nothing on the ones you haven't (sam);
//   - the hub (GET /api/couches/[id]/hub): your taste twin, Agree with the couch, the shows with a verdict, the accolades
//     (taste twins, the contrarian, never misses a rating), all counted up to your mark (sam's twins are "3 of 3", alex's
//     "5 of 5"); Couch verdicts (GET /api/couches/[id]/verdicts): a panel per show you've started at your latest episode, its
//     take and its score by episode, never past your mark.
//   In a real browser at --width (390 by default): as alex, Tonight's Rate it row (rated), the sheet (the verdict, everyone's
//   stars and takes), changing his stars, a take, Episodes' marks, the episode page's row, the hub's Couch verdicts row and
//   page, the profile's taste twin and Agree with the couch, By the numbers' accolades; as sam (behind), Rate Episode 3 from
//   Tonight (the verdict waits for his stars, then lands), nothing about 4 or 5; as riley, the Traitors (a show she only
//   watches) rated from its Episodes; and, on solo-fixture.js (people on no couch), zt_so_alex's Rate it with everyone's verdict
//   (a number only). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
// Part 2 is Call it, the couch's polls, predictions as chips and Weekly Calls (calls.ts, polls.ts), on the same fixtures plus
// talk-fixture.js (ZT Talk Tonight, a talk show alex and riley follow through Episode 3, Episode 4 in two days):
//   API, before Episode 6 airs: its two calls (Who goes home? from who's still in, one of the show's moments), the refusals
//   (an episode not open yet, someone already out, a call that isn't one, maybe, saying what happened before it airs, a couch
//   you're not on, sam behind: no faces, can't call), the couch's calls private until airtime (riley sees a count), taking a call
//   back; polls (start on the cast or your own options, the refusals, votes hidden until it closes, three at most on an episode,
//   only its starter takes it down, sam behind sees none); Commercial break's This week only; predictions' chips (a Who
//   question gets who's still in, a Will question Yes and No, anything else words); Weekly Calls on the talk show (startable
//   now, Weekly Bingo still coming; riley joins; its move on the hub until both calls are made; its game at 0; out of classic's
//   list). In the browser before it airs: alex's Call it from Tonight (faces, Yes / No, Lock in), the Games tab's This week (Call
//   it, the polls, Start a poll with options of his own), a vote changed, the Predictions tab's chips, Commercial break's cards,
//   the talk show's Weekly Calls card and Start a game sheet.
//   Then Episode 6 (and the talk show's 4) air: nobody calls it any more; alex sees his calls but nothing of the couch's until
//   he's seen it; then waiting, who went home (early) and every result (final) settle them, the couch's calls beside his, sam
//   and casey told nothing; the polls close (their votes for whoever's seen it, waiting for sam); the talk show's calls settled
//   by two saying what happened, Weekly Calls' table by right calls, on the hub too; and on solo-fixture.js, a public pool's
//   Who goes home? and Call it's are the same call, counted once its person goes home. In the browser: Tonight's row for how
//   Episode 6's calls went and the sheet, the poll's results, the talk show's row and the Weekly Calls table.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-episode-games.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js, talk-fixture.js and solo-fixture.js up and takes them down (--keep leaves
// them); touches zt rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const soloFixture = require("./solo-fixture");
const talkFixture = require("./talk-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-episode-games runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-episode-games.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;

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
    const so = await soloFixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    const A = fx.couchId;
    const X = fx.extraCouchId;
    const U = fx.users;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);

    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: u(who), pass: PASSWORD });
    const q = (couch) => (couch ? `?couch=${couch}` : "");
    const rate = (who, n, body, season = sid, couch = A) => as[who].call("POST", `/api/seasons/${season}/ratings/${n}${q(couch)}`, body);
    const verdict = (who, n, season = sid, couch = A) => as[who].call("GET", `/api/seasons/${season}/ratings/${n}${q(couch)}`);
    const rows = async (who, season = sid, couch = A) => (await as[who].call("GET", `/api/seasons/${season}/episodes${q(couch)}`)).body;
    const hub = async (who, couch = A) => (await as[who].call("GET", `/api/couches/${couch}/hub`)).body;
    const verdicts = async (who, couch = A) => (await as[who].call("GET", `/api/couches/${couch}/verdicts`)).body;
    const stored = async (who, n, season = sid) => (await pool.query("SELECT stars, take FROM episode_ratings WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], season, n])).rows[0] ?? null;

    // ---------- rating, and what's refused ----------
    let r = await rate("sam", 4, { stars: 3 });
    check(r.status === 403 && /haven't seen Episode 4/.test(r.body.error), "sam (on 3) can't rate Episode 4: 403", JSON.stringify(r.body));
    check(!(await stored("sam", 4)), "and nothing was saved");
    r = await rate("alex", 6, { stars: 3 });
    check(r.status === 403, "alex (on 5) can't rate Episode 6: 403");
    for (const [body, re, what] of [
      [{ stars: 0 }, /stars must be 1 to 5/, "no stars"],
      [{ stars: 6 }, /stars must be 1 to 5/, "six stars"],
      [{ stars: "four" }, /stars must be 1 to 5/, "stars that aren't a number"],
      [{ stars: 3, take: "x".repeat(141) }, /140 characters/, "a take over 140 characters"],
      [{ stars: 3, take: 42 }, /take must be words/, "a take that isn't words"],
    ]) {
      r = await rate("alex", 5, body);
      check(r.status === 400 && re.test(r.body.error), `${what}: 400`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await as.alex.call("POST", `/api/seasons/${sid}/ratings/zero${q(A)}`, { stars: 3 });
    check(r.status === 400, "an episode that isn't one: 400");
    r = await as.alex.call("POST", `/api/seasons/not-a-season/ratings/5${q(A)}`, { stars: 3 });
    check(r.status === 404, "a season that isn't one: 404");
    r = await rate("riley", 5, { stars: 3 }, sid, X);
    check(r.status === 404, "rating on a couch you're not on: 404");

    // The couch rates: alex and riley alike (alex's twin), jordan far off (the contrarian), sam behind.
    const seed = { alex: [4, 4, 3, 4, 5], riley: [4, 4, 3, 5, 4], jordan: [1, 2, 5, 1, 2] };
    for (const [who, list] of Object.entries(seed)) for (const [i, s] of list.entries()) await rate(who, i + 1, { stars: s });
    r = await rate("jordan", 5, { stars: 2, take: "  far   too slow  " });
    check(r.status === 200 && r.body.mine.take === "far too slow", "a take, tidied", JSON.stringify(r.body.mine));
    r = await rate("alex", 5, { stars: 5, take: "Best tribal of the season" });
    check(r.status === 200 && r.body.scope === "couch" && r.body.avg === 3.7 && r.body.n === 3, "alex rates Episode 5: the couch's verdict is 3.7 from 3", JSON.stringify(r.body).slice(0, 300));
    check(r.body.people[0].name === u("alex") && r.body.people.map((p) => p.name).sort().join() === [u("alex"), u("jordan"), u("riley")].sort().join(), "everyone who rated it, alex first");
    check(r.body.people.find((p) => p.name === u("jordan"))?.take === "far too slow", "with their takes");
    r = await rate("alex", 5, { stars: 5 });
    check((await stored("alex", 5)).take === "Best tribal of the season", "rating again with only stars keeps the take");
    r = await rate("alex", 5, { stars: 5, take: "" });
    check((await stored("alex", 5)).take === null && r.body.mine.take === null, "an empty take takes it away");
    await rate("alex", 5, { stars: 5, take: "Best tribal of the season" });
    r = await rate("sam", 2, { stars: 4 });
    check(r.status === 200, "sam rates Episode 2 (he's on 3)");
    await rate("sam", 1, { stars: 3 });
    r = await rate("casey", 5, { stars: 3 }, sid, X);
    check(r.status === 200 && r.body.avg === 4 && r.body.n === 2 && r.body.people.length === 2, "casey on ZT Extra: that couch's verdict is alex's and hers (4.0 from 2)", JSON.stringify(r.body).slice(0, 200));

    // Someone who sees results straight away still only rates what's aired.
    await pool.query(`INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = true`, [U.casey]);
    r = await rate("casey", 6, { stars: 3 }, sid, X);
    check(r.status === 409 && /hasn't aired/.test(r.body.error), "casey sees results straight away: Episode 6 hasn't aired, 409", JSON.stringify(r.body));
    await pool.query(`UPDATE user_settings SET show_results_immediately = false WHERE user_id = $1`, [U.casey]);

    // ---------- one episode's verdict ----------
    r = await verdict("riley", 5);
    check(r.status === 200 && r.body.avg === 3.7 && r.body.mine.stars === 4 && r.body.people[0].name === u("riley"), "riley reads Episode 5: 3.7, her own stars first");
    check(r.body.everyone && r.body.everyone.n === 4 && r.body.everyone.avg === 3.5, "and everyone on Game Your Show beside it (casey's too): 3.5 from 4", JSON.stringify(r.body.everyone));
    r = await verdict("sam", 5);
    check(r.status === 403 && !/stars|avg/.test(JSON.stringify(r.body)), "sam (on 3) reads Episode 5: 403, nothing about it", JSON.stringify(r.body));
    r = await verdict("sam", 3);
    check(r.status === 200 && r.body.n === 3 && !r.body.mine, "sam reads Episode 3: the couch's three, his own still to come");
    r = await verdict("alex", 5, sid, null);
    check(r.status === 200 && r.body.scope === "everyone" && r.body.n === 4 && r.body.avg === 3.5 && r.body.people.length === 1 && r.body.everyone === null, "no couch: everyone's verdict, a number (only alex's own face)", JSON.stringify(r.body).slice(0, 200));
    check(!new RegExp(u("jordan")).test(JSON.stringify(r.body)) && !/far too slow/.test(JSON.stringify(r.body)), "and never a stranger's name or take");
    r = await verdict("casey", 5, sid, A);
    check(r.status === 404, "a couch you're not on: 404");

    // The Traitors: riley follows openly (through 2), jordan privately (through 4).
    r = await rate("jordan", 2, { stars: 5, take: "the turret!" }, tsid, A);
    check(r.status === 200 && r.body.people.length === 1, "jordan rates the Traitors' Episode 2 (watching privately)");
    r = await rate("riley", 2, { stars: 3 }, tsid, A);
    check(r.status === 200 && r.body.n === 1 && r.body.people.length === 1 && r.body.everyone === null, "riley rates it too: the couch's verdict is hers alone; jordan's private stars count nowhere", JSON.stringify(r.body).slice(0, 300));
    check(!/turret/.test(JSON.stringify(r.body)), "nor his take");
    r = await rate("riley", 3, { stars: 3 }, tsid, A);
    check(r.status === 403, "riley (on 2) can't rate the Traitors' Episode 3");

    // ---------- the Episodes read ----------
    let e = await rows("alex");
    const ep = (body, n) => body.episodes.find((x) => x.number === n);
    check(JSON.stringify(ep(e, 5).verdict) === JSON.stringify({ avg: 3.7, n: 3, mine: 5 }), "Episodes: Episode 5 carries the couch's verdict and alex's stars", JSON.stringify(ep(e, 5).verdict));
    check(ep(e, 1).verdict.avg === 3 && ep(e, 1).verdict.n === 4, "and Episode 1 its own (sam rated it too)");
    e = await rows("sam");
    check(ep(e, 3).verdict.n === 3 && ep(e, 2).verdict.mine === 4, "sam's Episodes: his own stars on 2, the couch's on 3");
    check([4, 5].every((n) => !ep(e, n) || ep(e, n).verdict === undefined), "and nothing about 4 or 5 (results he hasn't revealed)", JSON.stringify(e.episodes.filter((x) => x.number > 3)));
    e = await rows("alex", sid, null);
    check(ep(e, 5).verdict.n === 4 && ep(e, 5).verdict.avg === 3.5, "with no couch, everyone's");

    // ---------- the hub ----------
    let h = await hub("alex");
    check(h.taste.twin?.name === u("riley") && h.taste.twin.line === "The same stars on 3 of 5 episodes", "alex's taste twin: riley", JSON.stringify(h.taste));
    check(h.taste.agree && h.taste.agree.of === 5 && h.taste.shows === 1, "Agree with the couch over the five episodes others rated; one show with a verdict", JSON.stringify(h.taste));
    const acc = (body) => Object.fromEntries(body.accolades.map((a) => [a.key, a]));
    let a = acc(h);
    check(a.twins?.who === `${u("alex")} and ${u("riley")}` && /3 of 5 episodes/.test(a.twins.line), "the accolades: alex and riley are the taste twins", JSON.stringify(a.twins));
    check(a.contrarian?.who === u("jordan"), "jordan is the contrarian", JSON.stringify(a.contrarian));
    check(a.rates?.who === u("alex") && /5 episodes of ZT Survivor 51 in a row/.test(a.rates.line), "and alex never misses a rating", JSON.stringify(a.rates));
    h = await hub("sam");
    a = acc(h);
    check(h.taste.twin === null, "sam: no twin yet (two episodes rated)");
    check(/of 3 episodes/.test(a.twins?.line ?? "") && !a.rates, "his accolades count only up to Episode 3 (the twins on 3 of 3, nobody's five in a row)", JSON.stringify(h.accolades));
    h = await hub("riley");
    check(!h.accolades.some((x) => /Traitors/.test(x.line)) && h.taste.shows === 2, "riley: two shows with a verdict (hers on the Traitors), jordan's private stars in nothing");

    // ---------- Couch verdicts ----------
    let v = await verdicts("alex");
    const s51 = v.shows.find((s) => s.seasonId === sid);
    check(v.shows.length === 1 && s51 && s51.episode === 5 && s51.avg === 3.7 && s51.n === 3 && s51.mine === 5, "alex's Couch verdicts: ZT Survivor 51 at Episode 5, 3.7 from 3", JSON.stringify(v).slice(0, 300));
    check(s51.take?.name === u("jordan") && s51.take.text === "far too slow", "the take on its plate is someone else's (the newest)", JSON.stringify(s51.take));
    check(s51.byEpisode.map((b) => b.avg).join() === "3,3.5,3.7,3.3,3.7", "the couch's score by episode", JSON.stringify(s51.byEpisode));
    v = await verdicts("sam");
    check(v.shows.length === 1 && v.shows[0].episode === 3 && v.shows[0].byEpisode.length === 3 && v.shows[0].mine === null, "sam's: Episode 3, nothing past it", JSON.stringify(v).slice(0, 300));
    v = await verdicts("riley");
    const tr = v.shows.find((s) => s.seasonId === tsid);
    check(v.shows.length === 2 && tr && tr.episode === 2 && tr.n === 1 && !tr.take, "riley's: both shows; the Traitors at Episode 2, hers alone", JSON.stringify(tr));
    check((await as.casey.call("GET", `/api/couches/${A}/verdicts`)).status === 404, "a couch you're not on: 404");

    // ---------- solo: everyone's verdict ----------
    const solo = {};
    for (const who of ["alex", "riley", "jordan"]) solo[who] = await api({ user: soloFixture.username(who), pass: PASSWORD });
    await solo.riley.call("POST", `/api/seasons/${so.seasonId}/ratings/5`, { stars: 4, take: "zt: a stranger's take" });
    r = await solo.jordan.call("POST", `/api/seasons/${so.seasonId}/ratings/5`, { stars: 2 });
    check(r.status === 200 && r.body.scope === "everyone" && r.body.n === 2 && r.body.avg === 3 && r.body.people.length === 1, "solo (no couch): everyone's verdict, 3.0 from 2, only his own face", JSON.stringify(r.body).slice(0, 200));
    r = await solo.alex.call("GET", `/api/seasons/${so.seasonId}/ratings/5`);
    check(r.status === 200 && r.body.n === 2 && r.body.people.length === 0 && !r.body.mine && !/stranger|zt_so_/.test(JSON.stringify(r.body)), "zt_so_alex, before rating: a number, never a stranger's name or take", JSON.stringify(r.body));

    // ================= part 2: Call it, the couch's polls, predictions as chips, Weekly Calls =================
    const tk = await talkFixture.up(pool, fx);
    const callsOf = (who, n, season = sid, couch = A) => as[who].call("GET", `/api/seasons/${season}/calls/${n}${q(couch)}`);
    const callIt = (who, n, body, season = sid, couch = A) => as[who].call("POST", `/api/seasons/${season}/calls/${n}${q(couch)}`, body);
    const storedCalls = async (who, n, season = sid) =>
      Object.fromEntries((await pool.query("SELECT question, answer FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = $3", [U[who], season, n])).rows.map((x) => [x.question, x.answer]));
    const castRows = (await pool.query("SELECT id, name FROM season_cast WHERE season_id = $1", [sid])).rows;
    const gone = (await pool.query("SELECT castaway_name FROM season_decisions WHERE season_id = $1 AND kind = 'elimination' AND status = 'accepted'", [sid])).rows.map((x) => x.castaway_name);

    // ---------- Call it, before Episode 6 airs ----------
    let c = await callsOf("alex", 6);
    check(c.status === 200 && c.body.status === "open" && c.body.questions.length === 2 && c.body.scope === "couch", "Call it, Episode 6 (next to air): open, two calls", JSON.stringify(c.body).slice(0, 200));
    const outQ = c.body.questions.find((x) => x.key === "out");
    const momentQ = c.body.questions.find((x) => x.key !== "out");
    check(
      !!outQ && outQ.kind === "cast" && outQ.lead === "Who goes home?" && outQ.options.length === castRows.length - gone.length && outQ.options.every((o) => !gone.includes(o.label) && !!o.photo),
      "Who goes home?: everyone still in (with faces), nobody already out",
      `${outQ?.options.length} of ${castRows.length}, ${gone.length} gone`
    );
    check(!!momentQ && momentQ.kind === "yesno" && momentQ.by === "results" && momentQ.lead === "Anyone this episode?" && /^m:/.test(momentQ.key) && !!momentQ.what, "and one of the show's moments, yes or no", JSON.stringify(momentQ));
    const GO = outQ.options[0];
    const STAY = outQ.options[1];
    r = await callsOf("alex", 7);
    check(r.status === 409 && /open for Episode 6/.test(r.body.error), "Episode 7 isn't open yet: 409", JSON.stringify(r.body));
    r = await callIt("alex", 6, { calls: { out: castRows.find((x) => gone.includes(x.name)).id } });
    check(r.status === 400 && /still in/.test(r.body.error), "calling someone already out: 400", JSON.stringify(r.body));
    r = await callIt("alex", 6, { calls: { "m:nothingLikeIt": "yes" } });
    check(r.status === 400, "a call that isn't one of Episode 6's: 400");
    r = await callIt("alex", 6, { calls: { [momentQ.key]: "maybe" } });
    check(r.status === 400 && /Yes or no/.test(r.body.error), "maybe isn't yes or no: 400", JSON.stringify(r.body));
    r = await callIt("alex", 6, {});
    check(r.status === 400, "nothing to save: 400");
    r = await callIt("alex", 6, { said: { [momentQ.key]: "yes" } });
    check(r.status === 403, "saying what happened before it's aired: 403");
    r = await callsOf("casey", 6);
    check(r.status === 404, "a couch you're not on: 404");
    r = await as.alex.call("GET", `/api/seasons/not-a-season/calls/6${q(A)}`);
    check(r.status === 404, "a season that isn't one: 404");
    r = await callsOf("sam", 6);
    check(r.status === 200 && r.body.status === "behind" && r.body.catchUp === 5 && r.body.questions.length === 0, "sam (on 3): behind, see Episode 5 first; no faces sent (they'd say who's out)", JSON.stringify(r.body).slice(0, 200));
    r = await callIt("sam", 6, { calls: { out: GO.key } });
    check(r.status === 403, "and he can't call it: 403");
    r = await callIt("alex", 6, { calls: { out: GO.key, [momentQ.key]: "yes" } });
    let mine = await storedCalls("alex", 6);
    check(r.status === 200 && r.body.mine.out === GO.key && r.body.mine[momentQ.key] === "yes" && mine.out === GO.key && mine[momentQ.key] === "yes", "alex calls both: saved", JSON.stringify(mine));
    await callIt("riley", 6, { calls: { out: STAY.key, [momentQ.key]: "no" } });
    await callIt("jordan", 6, { calls: { out: GO.key } });
    r = await callsOf("riley", 6);
    check(
      r.body.people.length === 0 && r.body.called === 3 && r.body.mine.out === STAY.key && !JSON.stringify(r.body).includes(u("alex")),
      "private until it airs: riley sees that 3 have called it, not who called what",
      JSON.stringify({ people: r.body.people, called: r.body.called })
    );
    r = await callIt("alex", 6, { calls: { [momentQ.key]: null } });
    check(!r.body.mine[momentQ.key] && !(momentQ.key in (await storedCalls("alex", 6))), "a call taken back");
    // alex makes his calls again in the browser (or here, with --api).
    await callIt("alex", 6, apiOnly ? { calls: { [momentQ.key]: "yes" } } : { calls: { out: null } });
    let home = (await as.alex.call("GET", "/api/me/home")).body;
    check(!home.moves.some((m) => m.kind === "calls"), "Call it is an extra, never a move (nobody plays Weekly Calls here)");

    // ---------- the couch's polls ----------
    const pollsOf = (who, season = sid, couch = A) => as[who].call("GET", `/api/seasons/${season}/polls${q(couch)}`);
    const startPoll = (who, body, season = sid, couch = A) => as[who].call("POST", `/api/seasons/${season}/polls${q(couch)}`, body);
    const answer = (who, id, body) => as[who].call("POST", `/api/polls/${id}`, body);
    const pollIn = (body, id) => body.polls.find((x) => x.id === id);
    r = await pollsOf("alex");
    check(r.status === 200 && r.body.polls.length === 0 && r.body.start?.episode === 6 && r.body.start.cast === true, "polls: none yet; alex can start one for Episode 6, on the cast", JSON.stringify(r.body));
    r = await pollsOf("sam");
    check(r.status === 200 && r.body.start === null, "sam (behind) can't start one");
    r = await startPoll("sam", { question: "Who goes next?", cast: true });
    check(r.status === 403, "and starting one anyway: 403");
    for (const [body, re, what] of [
      [{ question: "x", cast: true }, /Ask the couch/, "a question too short"],
      [{ question: "Big twist?", options: ["A swap"] }, /Two to four/, "one option"],
      [{ question: "Big twist?", options: ["A swap", "a swap"] }, /Each option once/, "the same option twice"],
      [{ question: "Big twist?" }, /options required/, "no options"],
    ]) {
      r = await startPoll("alex", body);
      check(r.status === 400 && re.test(r.body.error), `${what}: 400`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await startPoll("casey", { question: "Who goes next?", cast: true });
    check(r.status === 404, "a couch you're not on: 404");
    r = await startPoll("alex", { question: "Who gets the boot?", cast: true });
    const P1 = r.body.id;
    check(r.status === 200 && pollIn(r.body, P1)?.cast && pollIn(r.body, P1).options.length === outQ.options.length && pollIn(r.body, P1).yours, "alex starts a poll on the cast still in", JSON.stringify(r.body).slice(0, 200));
    r = await startPoll("riley", { question: "Big twist this week?", options: ["A swap", "A merge", "Nothing"] });
    const P2 = r.body.id;
    check(r.status === 200 && pollIn(r.body, P2)?.options.map((o) => o.label).join() === "A swap,A merge,Nothing", "riley starts one with options of her own");
    await answer("riley", P1, { vote: GO.key });
    await answer("jordan", P1, { vote: GO.key });
    r = await answer("alex", P1, { vote: STAY.key });
    check(r.status === 200 && pollIn(r.body, P1).vote === STAY.key, "votes: alex's own");
    await answer("alex", P2, { vote: "1" });
    r = await answer("alex", P1, { vote: "nope" });
    check(r.status === 400, "a vote for something not on it: 400");
    r = await answer("sam", P1, { vote: GO.key });
    check(r.status === 404, "sam (behind) can't see it to vote: 404");
    r = await pollsOf("riley");
    let p1 = pollIn(r.body, P1);
    check(p1.open && p1.votes === 3 && p1.vote === GO.key && p1.results === null && !JSON.stringify(p1).includes(u("jordan")), "riley: 3 votes so far and her own; nobody else's until it closes", JSON.stringify(p1).slice(-200));
    r = await pollsOf("sam");
    check(r.body.polls.length === 0, "sam sees no poll about an episode two past his");
    r = await startPoll("alex", { question: "Who finds an idol?", cast: true });
    const P3 = r.body.id;
    r = await startPoll("riley", { question: "One too many?", options: ["Yes", "No"] });
    check(r.status === 409 && /3 polls on Episode 6/.test(r.body.error), "a fourth on one episode: 409", JSON.stringify(r.body));
    r = await answer("riley", P3, { remove: true });
    check(r.status === 403, "only whoever started it takes it down: 403");
    r = await answer("alex", P3, { remove: true });
    check(r.status === 200 && !pollIn(r.body, P3), "alex takes his down");

    // ---------- Commercial break's This week only ----------
    r = await as.alex.call("GET", `/api/couches/${A}/this-week`);
    const wk = r.body.shows?.find((s) => s.seasonId === sid);
    check(r.status === 200 && wk?.episode === 6 && wk.calls?.of === 2 && wk.calls.made === Object.keys(await storedCalls("alex", 6)).length, "This week only: ZT Survivor 51's Call it, and how far he's got", JSON.stringify(wk));
    check(r.body.polls.map((p) => p.id).sort().join() === [P1, P2].sort().join(), "and the couch's two polls");

    // ---------- predictions as chips ----------
    await pool.query(`UPDATE leagues SET state = jsonb_set(state, '{settings,bonusEnabled}', 'true') WHERE id = $1`, [fx.leagues.lineup]);
    for (const label of ["Who wins immunity?", "Will an idol be played?", "How many votes does the boot get?"]) {
      r = await as.alex.call("POST", `/api/leagues/${fx.leagues.lineup}/episodes/upcoming/bets`, { label, points: 2 });
      check(r.status === 200, `a prediction proposed: ${label}`, JSON.stringify(r.body).slice(0, 200));
    }
    r = await as.alex.call("GET", `/api/seasons/${sid}/games${q(A)}`);
    const lineupG = r.body.games.find((g) => g.leagueId === fx.leagues.lineup);
    const pred = (label) => lineupG?.predictions.find((p) => p.label === label);
    check(pred("Who wins immunity?")?.options?.length === outQ.options.length && pred("Who wins immunity?").options.every((o) => !gone.includes(o)), "a Who prediction's answers: everyone still in", JSON.stringify(pred("Who wins immunity?")));
    check(JSON.stringify(pred("Will an idol be played?")?.options) === '["Yes","No"]', "a Will prediction's: Yes and No");
    check(pred("How many votes does the boot get?")?.options === null, "anything else is answered in words");

    // ---------- Weekly Calls, the talk show's season game ----------
    r = await as.alex.call("GET", `/api/seasons/${tk.seasonId}/start${q(A)}`);
    const wcFit = r.body.games?.find((g) => g.key === "weeklyCalls");
    const wbFit = r.body.games?.find((g) => g.key === "weeklyBingo");
    check(r.body.kind === "talk" && wcFit?.fits && wcFit.soon === null && wcFit.type === "weekly-calls" && wbFit?.soon === "12", "a talk show: Weekly Calls starts now, Weekly Bingo still coming", JSON.stringify(r.body.games));
    r = await as.alex.call("POST", `/api/seasons/${tk.seasonId}/start${q(A)}`, { game: "weeklyCalls", tell: false });
    const WC = r.body.leagueId;
    check(r.status === 200 && r.body.gameName === "Weekly Calls" && r.body.from === 4, "alex starts Weekly Calls, from Episode 4", JSON.stringify(r.body));
    check((await pool.query("SELECT state->'settings'->>'leagueTypeId' AS t FROM leagues WHERE id = $1", [WC])).rows[0]?.t === "weekly-calls", "a league that plays as weekly-calls");
    r = await as.riley.call("POST", `/api/couches/${A}/games/${WC}`, { action: "join", start: null });
    check(r.status === 200, "riley joins it from the couch", JSON.stringify(r.body));
    home = (await as.alex.call("GET", "/api/me/home")).body;
    const mv = home.moves.find((m) => m.kind === "calls" && m.leagueId === WC);
    check(mv?.episode === 4 && /two calls/.test(mv.text) && !!mv.deadline, "the hub: alex's move is this week's two calls", JSON.stringify(mv));
    r = await as.alex.call("GET", `/api/seasons/${tk.seasonId}/games${q(A)}`);
    let wg = r.body.games?.find((g) => g.leagueId === WC);
    check(wg?.gameType === "weekly-calls" && wg.call?.made === 0 && wg.call.of === 2 && wg.call.episode === 4 && wg.table.length === 2 && wg.table.every((t) => t.total === 0), "its game: two players at 0, his calls 0 of 2", JSON.stringify(wg).slice(0, 300));
    c = await callsOf("alex", 4, tk.seasonId);
    const tq = c.body.questions ?? [];
    check(c.body.status === "open" && tq.length === 2 && tq.every((x) => x.by === "couch" && x.lead === "Tonight?" && x.kind === "yesno"), "a talk show's calls: two of its moments, which the couch settles", JSON.stringify(tq));
    await callIt("alex", 4, { calls: { [tq[0].key]: "yes", [tq[1].key]: "no" } }, tk.seasonId);
    await callIt("riley", 4, { calls: { [tq[0].key]: "no", [tq[1].key]: "no" } }, tk.seasonId);
    r = await callsOf("sam", 4, tk.seasonId);
    check(r.body.status === "open", "sam (not following it) can still call a talk show: its calls give nothing away");
    home = (await as.alex.call("GET", "/api/me/home")).body;
    check(!home.moves.some((m) => m.kind === "calls"), "both made: the move's gone");
    r = await as.alex.call("GET", "/api/me");
    check(r.status === 200 && !(r.body.leagues ?? []).some((l) => l.id === WC), "and classic's league list leaves it out");

    // The browser, for both parts.
    const noBadge = () => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    };
    let n = 0;
    const browse = async (who) => {
      const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      let favicon = 0;
      b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
      const pg = b.page;
      return {
        pg,
        shot: async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${who}-${name}.png`) });
        },
        wide: async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
        },
        errors: () => b.errors.filter((x) => !/Failed to load resource/.test(x)).concat(b.errors.filter((x) => /Failed to load resource/.test(x)).slice(favicon)),
        sheet: () => pg.locator("[role=dialog][data-open]"),
        closed: () => pg.locator("[role=dialog][data-open]").waitFor({ state: "detached" }).catch(() => {}),
        statuses: async () => (await pg.locator("[role=status]").allTextContents()).join(" | "),
      };
    };

    if (!apiOnly) {
      // ---------- alex ----------
      const X1 = await browse("alex");
      const pg = X1.pg;
      await pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const row = pg.locator('[data-rate-row="5"]');
      await row.waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const rowText = await row.innerText();
      check((await row.getAttribute("data-rated")) === "yes" && /You gave Episode 5/.test(rowText) && /3\.7/.test(rowText), "Tonight's Extras: Episode 5, rated, the couch's 3.7", rowText);
      await row.scrollIntoViewIfNeeded();
      await X1.shot("tonight-rated");
      await X1.wide("Tonight");
      await row.click();
      const sheet = pg.locator('[data-rate-sheet="5"]');
      await sheet.waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(500);
      check((await pg.locator("[data-verdict-score]").innerText()) === "3.7" && (await pg.locator("[data-verdict-person]").count()) === 3, "the sheet: the verdict, everyone's stars");
      check(/far too slow/.test(await pg.locator("[data-verdict]").innerText()) && (await pg.locator("[data-take-input]").inputValue()) === "Best tribal of the season", "their takes, and his own in the field");
      check(/Everyone on Game Your Show/.test(await pg.locator("[data-verdict-everyone]").innerText()), "and everyone's, beside the couch's");
      await X1.shot("sheet-rated");
      await pg.locator('[data-star="3"]').click();
      await pg.waitForFunction(() => document.querySelector("[data-verdict-score]")?.textContent === "3.0", null, { timeout: 10_000 }).catch(() => {});
      check((await pg.locator("[data-verdict-score]").innerText()) === "3.0" && (await stored("alex", 5)).stars === 3, "three stars: saved, the verdict moves to 3.0");
      check((await pg.locator("[data-verdict-said]").getAttribute("data-verdict-said")) === "agree", "and he agrees with the couch", await pg.locator("[data-verdict-said]").innerText().catch(() => ""));
      await pg.locator("[data-take-input]").fill("Tribal was chaos");
      await pg.locator("[data-take-save]").click();
      await pg.waitForFunction(() => /Your take is in/.test(document.body.innerText), null, { timeout: 10_000 }).catch(() => {});
      check((await stored("alex", 5)).take === "Tribal was chaos" && /Your take is in/.test(await X1.statuses()), "a new take: posted, the toast says so", await X1.statuses());
      await pg.waitForTimeout(400);
      await X1.shot("sheet-changed");
      await X1.wide("the rate sheet");
      await X1.sheet().getByRole("button", { name: "Done" }).click();
      await X1.closed();
      await pg.waitForFunction(() => /You gave Episode 5 ★★★(?!★)/.test(document.querySelector('[data-rate-row="5"]')?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
      check(/You gave Episode 5 ★★★(?!★)/.test(await row.innerText()), "Done: the row says three stars", await row.innerText());

      // Episodes, and the episode page.
      await pg.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
      await pg.locator('[data-ep="5"] [data-verdict-mark]').waitFor({ timeout: 30_000 });
      await pg.waitForTimeout(800);
      const mark = await pg.locator('[data-ep="5"] [data-verdict-mark]').innerText();
      check(/3\.0/.test(mark) && /you 3/.test(mark), "Episodes: Episode 5's mark, the couch's 3.0 and his 3", mark);
      await X1.shot("episodes");
      await X1.wide("Episodes");
      await pg.locator('[data-ep="5"]').click();
      await pg.locator('[data-episode-rate] [data-rate-row="5"]').waitFor({ timeout: 20_000 });
      await pg.locator("[data-episode-rate]").scrollIntoViewIfNeeded();
      await pg.waitForTimeout(500);
      check(/You gave Episode 5/.test(await pg.locator("[data-episode-rate]").innerText()), "the episode page: How was it?");
      await X1.shot("episode-page");

      // The hub: Couch verdicts, the profile, By the numbers. (The fixture's couch is new, so the hub would grow with it:
      // ?hub=focus asks for the shape with More on the couch, as check-new-hub does.)
      await pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      // The row's wrapper is display: contents (no box of its own): its button is what shows.
      const vrow = pg.locator('[data-more="verdicts"] button');
      await vrow.waitFor({ timeout: 30_000 });
      await pg.waitForFunction(() => /How the couch rated 1 show/.test(document.querySelector('[data-more="verdicts"]')?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => {});
      check(/How the couch rated 1 show/.test(await vrow.innerText()), "More on the couch: How the couch rated 1 show", await vrow.innerText());
      await vrow.scrollIntoViewIfNeeded();
      await vrow.click();
      await pg.locator(`[data-couch-page="verdicts"] [data-verdict-show="${sid}"]`).waitFor({ timeout: 20_000 });
      await pg.waitForTimeout(700);
      const panel = pg.locator(`[data-verdict-show="${sid}"]`);
      check((await panel.locator("[data-verdict-score]").innerText()) === "3.0" && (await panel.locator("[data-verdict-person]").count()) === 3, "Couch verdicts: ZT Survivor 51's panel, 3.0, three faces");
      check(/far too slow/.test(await panel.locator("[data-verdict-take]").innerText()) && (await panel.locator("[data-verdict-bars] > span").count()) === 5, "jordan's take on its plate, five bars");
      check(/Taste twin: zt_nd_riley/.test(await pg.locator('[data-couch-page="verdicts"]').innerText()) && /contrarian/.test(await pg.locator('[data-couch-page="verdicts"]').innerText()), "and the footnote: his taste twin, the contrarian");
      check((await pg.locator('[data-couch-page="verdicts"] [data-preview]').count()) === 0, "no Preview left on it");
      await X1.shot("couch-verdicts");
      await X1.wide("Couch verdicts");
      await pg.goBack();
      await pg.waitForTimeout(600);
      await pg.getByRole("button", { name: "Your profile" }).click();
      await pg.locator("[data-your-numbers]").waitFor();
      await pg.waitForTimeout(500);
      const nums = await pg.locator("[data-your-numbers]").innerText();
      check(/Agree with the couch/.test(nums) && /Taste twin: zt_nd_riley/.test(nums), "the profile: Agree with the couch, Taste twin: riley", nums);
      await X1.shot("profile");
      await pg.keyboard.press("Escape");
      await X1.closed();
      await pg.locator('[data-more="numbers"] button').click();
      await pg.locator('[data-couch-page="numbers"] [data-accolades]').waitFor({ timeout: 20_000 });
      const accs = await pg.$$eval('[data-couch-page="numbers"] [data-accolade-row]', (els) => els.map((x) => x.dataset.accoladeRow));
      check(["twins", "contrarian", "rates"].every((k) => accs.includes(k)), "By the numbers: taste twins, the contrarian, never misses a rating", accs.join());
      await pg.locator('[data-couch-page="numbers"] [data-accolade-row="twins"]').scrollIntoViewIfNeeded();
      await pg.waitForTimeout(400);
      await X1.shot("accolades");
      check(X1.errors().length === 0, "no page errors (alex)", X1.errors().join(" | "));

      // ---------- sam, behind ----------
      const S = await browse("sam");
      await S.pg.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const srow = S.pg.locator('[data-rate-row="3"]');
      await srow.waitFor({ timeout: 30_000 });
      await S.pg.waitForTimeout(800);
      check((await srow.getAttribute("data-rated")) === "no" && /Rate Episode 3/.test(await srow.innerText()), "sam's Tonight: Rate Episode 3 (his latest)", await srow.innerText());
      check((await S.pg.locator('[data-rate-row="4"], [data-rate-row="5"]').count()) === 0, "nothing for 4 or 5");
      await srow.click();
      await S.pg.locator('[data-rate-sheet="3"]').waitFor({ timeout: 20_000 });
      await S.pg.waitForTimeout(500);
      check(/3 on the couch rated it/.test(await S.pg.locator("[data-verdict-wait]").innerText()) && (await S.pg.locator("[data-verdict]").count()) === 0, "the sheet: three rated it; the verdict waits for his stars");
      await S.shot("sheet-unrated");
      await S.pg.locator('[data-star="4"]').click();
      await S.pg.locator("[data-verdict]").waitFor({ timeout: 10_000 });
      await S.pg.waitForTimeout(500);
      check((await stored("sam", 3)).stars === 4 && (await S.pg.locator("[data-verdict-person]").count()) === 4, "four stars: saved, and the verdict lands with all four", String((await stored("sam", 3))?.stars));
      check(!/far too slow|Tribal was chaos/.test(await S.sheet().innerText()), "nothing said about Episode 5");
      await S.shot("sheet-rated");
      await S.wide("sam's rate sheet");
      await S.sheet().getByRole("button", { name: "Done" }).click();
      await S.closed();
      await S.pg.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
      await S.pg.locator('[data-ep="3"] [data-verdict-mark]').waitFor({ timeout: 30_000 });
      check((await S.pg.locator("[data-ep-hidden] [data-verdict-mark]").count()) === 0, "his Episodes: a mark on 3, none on the hidden ones");
      await S.shot("episodes");
      check(S.errors().length === 0, "no page errors (sam)", S.errors().join(" | "));

      // ---------- riley: a show she only watches ----------
      const R = await browse("riley");
      await R.pg.goto(`${BASE}/show/${tsid}/episodes`, { waitUntil: "load" });
      const r1 = R.pg.locator('[data-ep="1"], [data-ep-aired="1"]').first();
      await r1.waitFor({ timeout: 30_000 });
      await R.pg.waitForTimeout(800);
      const r2 = await R.pg.locator('[data-ep="2"] [data-verdict-mark], [data-ep-aired="2"] [data-verdict-mark]').first().innerText().catch(() => "");
      check(/3\.0/.test(r2) && /you 3/.test(r2), "riley's Traitors Episodes: Episode 2, hers alone (3.0)", r2);
      await R.shot("traitors-episodes");
      await R.pg.goto(`${BASE}/show/${tsid}/tonight`, { waitUntil: "load" });
      const rrow = R.pg.locator('[data-rate-row="2"]');
      await rrow.waitFor({ timeout: 30_000 });
      await rrow.click();
      await R.pg.locator('[data-rate-sheet="2"]').waitFor({ timeout: 20_000 });
      await R.pg.waitForTimeout(500);
      check(/first on the couch/.test(await R.sheet().innerText()) && !/turret/.test(await R.sheet().innerText()), "the sheet: she's the first on the couch (jordan's private stars and take nowhere)");
      await R.shot("traitors-sheet");
      check(R.errors().length === 0, "no page errors (riley)", R.errors().join(" | "));

      // ---------- solo ----------
      const b = await open({ user: soloFixture.username("alex"), pass: PASSWORD, width, height: 844, motion: "off" });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      const sp = b.page;
      await sp.goto(`${BASE}/show/${so.seasonId}/tonight`, { waitUntil: "load" });
      const solorow = sp.locator('[data-rate-row="5"]');
      await solorow.waitFor({ timeout: 30_000 });
      await sp.waitForTimeout(800);
      check(/how everyone rated it/.test(await solorow.innerText()), "solo Tonight: Rate Episode 5, then see how everyone rated it", await solorow.innerText());
      await solorow.click();
      await sp.locator('[data-rate-sheet="5"]').waitFor({ timeout: 20_000 });
      await sp.waitForTimeout(500);
      check(/2 on Game Your Show rated it/.test(await sp.locator("[data-verdict-wait]").innerText()), "the sheet: two on Game Your Show rated it");
      await sp.locator('[data-star="5"]').click();
      await sp.locator("[data-verdict]").waitFor({ timeout: 10_000 });
      await sp.waitForTimeout(500);
      const plate = await sp.locator("[data-verdict]").innerText();
      check(/Everyone.s verdict/i.test(plate) && (await sp.locator("[data-verdict-score]").innerText()) === "3.7" && /from 3 on Game Your Show/.test(plate), "five stars: everyone's verdict, 3.7 from 3", plate);
      check((await sp.locator("[data-verdict-person]").count()) === 0 && !/stranger/.test(plate), "no faces, no strangers' takes");
      check((await sp.locator("[data-verdict-said]").getAttribute("data-verdict-said")) === "contrarian" && /Everyone else saw it differently/.test(plate), "and he's far from everyone else (5 against their 3)", plate);
      await sp.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-solo-sheet.png`) });
      const over = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 1, "solo sheet: nothing wider than the screen", `${over}px`);
      check(b.errors.filter((x) => !/favicon/.test(x)).length === 0, "no page errors (solo)", b.errors.join(" | "));

      // ================= part 2 in the browser, before Episode 6 airs =================
      const C1 = await browse("alex");
      const cp = C1.pg;
      await cp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const crow = cp.locator('[data-call-row="6"]');
      await crow.waitFor({ timeout: 30_000 });
      await cp.waitForTimeout(800);
      check((await crow.getAttribute("data-called")) === "no" && /Call it for Episode 6/.test(await crow.innerText()), "Tonight's Extras: Call it for Episode 6", await crow.innerText());
      await crow.scrollIntoViewIfNeeded();
      await C1.shot("tonight-call-row");
      await crow.click();
      const csheet = cp.locator('[data-call-sheet="6"][data-call-status="open"]');
      await csheet.waitFor({ timeout: 20_000 });
      await cp.waitForTimeout(500);
      check((await csheet.locator('[data-call-q="out"] [data-call-option]').count()) === outQ.options.length, "the sheet: Who goes home?'s faces, everyone still in");
      // riley and jordan have (alex took his back above).
      check(/2 on the couch have called it/.test(await cp.locator("[data-call-count]").innerText()), "how many on the couch have called it, nobody's call", await cp.locator("[data-call-count]").innerText());
      await csheet.locator(`[data-call-q="out"] [data-call-option="${GO.key}"]`).click();
      await csheet.locator(`[data-call-q="${momentQ.key}"] [data-call-option="yes"]`).click();
      check(/Lock in my calls/.test(await cp.locator("[data-call-save]").innerText()), "picked: Lock in my calls");
      await C1.shot("call-sheet");
      await C1.wide("the call sheet");
      await cp.locator("[data-call-save]").click();
      await C1.closed();
      await cp.waitForFunction(() => document.querySelector('[data-call-row="6"]')?.getAttribute("data-called") === "yes", null, { timeout: 10_000 }).catch(() => {});
      mine = await storedCalls("alex", 6);
      check(mine.out === GO.key && mine[momentQ.key] === "yes" && /Called it · change until/.test(await C1.statuses()), "locked in: saved, and the toast says until when", JSON.stringify(mine));
      check(/Your calls for Episode 6 are in/.test(await crow.innerText()), "the row says his calls are in", await crow.innerText());

      // The Predictions tab: a Who question's faces as chips, a Will question's Yes and No.
      await cp.getByRole("button", { name: /predictions need your guess/ }).click();
      const moves = C1.sheet();
      await moves.getByRole("tab", { name: "Predictions" }).click().catch(() => {});
      await moves.locator("[data-guess-chip]").first().waitFor({ timeout: 15_000 });
      const yes = moves.locator(`[data-guess="${pred("Will an idol be played?").betId}"][data-guess-chip="Yes"]`);
      const who = moves.locator(`[data-guess="${pred("Who wins immunity?").betId}"][data-guess-chip="${STAY.label}"]`);
      check((await moves.locator(`[data-guess="${pred("Who wins immunity?").betId}"][data-guess-chip]`).count()) === outQ.options.length && (await yes.count()) === 1, "the Predictions tab: the cast as chips, and Yes / No");
      check((await moves.locator(`input[data-guess="${pred("How many votes does the boot get?").betId}"]`).count()) === 1, "a question in words keeps its field");
      await yes.click();
      await who.click();
      await moves.locator(`input[data-guess="${pred("How many votes does the boot get?").betId}"]`).fill("3");
      await C1.shot("predict-chips");
      await moves.getByRole("button", { name: "Save" }).click();
      await C1.closed();
      await cp.waitForTimeout(800);
      r = await as.alex.call("GET", `/api/seasons/${sid}/games${q(A)}`);
      const guessOf = (label) => r.body.games.find((g) => g.leagueId === fx.leagues.lineup)?.predictions.find((p) => p.label === label)?.guess?.text;
      check(guessOf("Will an idol be played?") === "Yes" && guessOf("Who wins immunity?") === STAY.label && guessOf("How many votes does the boot get?") === "3", "saved through the classic routes: Yes, a name, and 3", JSON.stringify(r.body.games.find((g) => g.leagueId === fx.leagues.lineup)?.predictions));

      // The Games tab's This week: Call it, the couch's polls, Start a poll.
      await cp.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await cp.locator("[data-this-week] [data-call-row]").waitFor({ timeout: 30_000 });
      await cp.locator(`[data-poll-row="${P1}"]`).waitFor({ timeout: 20_000 });
      await cp.waitForTimeout(800);
      check((await cp.locator(`[data-this-week] [data-poll-row]`).count()) === 2 && /You voted/.test(await cp.locator(`[data-poll-row="${P1}"]`).innerText()), "This week: Call it, both polls (alex voted in his)", await cp.locator("[data-this-week]").innerText());
      check((await cp.locator("[data-this-week] [data-preview]").count()) >= 1, "bingo and trivia still Preview (part 3)");
      await cp.locator("[data-this-week]").scrollIntoViewIfNeeded();
      await C1.shot("games-this-week");
      await C1.wide("the Games tab");
      // Changing his vote in his own poll.
      await cp.locator(`[data-poll-row="${P1}"]`).click();
      const vsheet = cp.locator(`[data-poll-sheet="${P1}"][data-poll-state="open"]`);
      await vsheet.waitFor({ timeout: 20_000 });
      await cp.waitForTimeout(400);
      check(/Your vote is in · 3 votes so far/.test(await cp.locator("[data-poll-line]").innerText()) && (await vsheet.locator(`[data-poll-option="${STAY.key}"][aria-pressed="true"]`).count()) === 1, "his poll: his vote, 3 so far, nobody else's", await cp.locator("[data-poll-line]").innerText());
      await vsheet.locator(`[data-poll-option="${GO.key}"]`).click();
      await cp.waitForFunction((k) => document.querySelector(`[data-poll-option="${k}"]`)?.getAttribute("aria-pressed") === "true", GO.key, { timeout: 10_000 }).catch(() => {});
      check((await pool.query("SELECT option FROM couch_poll_votes WHERE poll_id = $1 AND user_id = $2", [P1, U.alex])).rows[0]?.option === GO.key, "a tap changes his vote");
      await C1.shot("poll-vote");
      await cp.keyboard.press("Escape");
      await C1.closed();
      // Start a poll with options of his own.
      await cp.locator('[data-poll-start-row="6"]').click();
      await cp.locator('[data-poll-start="6"]').waitFor({ timeout: 20_000 });
      await cp.locator("[data-poll-question]").fill("Who wins the reward?");
      await cp.locator('[data-poll-kind="own"]').click();
      await cp.locator('[data-poll-own="0"]').fill("Toka");
      await cp.locator('[data-poll-own="1"]').fill("Savu");
      await cp.locator("[data-poll-add]").click();
      await cp.locator('[data-poll-own="2"]').fill("Dina");
      await C1.shot("poll-start");
      await cp.locator("[data-poll-go]").click();
      await C1.closed();
      const made = (await pool.query("SELECT id, options FROM couch_polls WHERE couch_id = $1 AND question = 'Who wins the reward?'", [A])).rows[0];
      check(!!made && made.options.map((o) => o.label).join() === "Toka,Savu,Dina" && /Poll started/.test(await C1.statuses()), "Start a poll: his question and three options, open until it airs", JSON.stringify(made));
      if (made) {
        await cp.locator(`[data-poll-row="${made.id}"]`).waitFor({ timeout: 10_000 });
        await pool.query("DELETE FROM couch_polls WHERE id = $1", [made.id]);
      }

      // Commercial break's This week only.
      await cp.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
      const brk = cp.locator('[data-more="break"] button');
      await brk.waitFor({ timeout: 30_000 });
      await brk.scrollIntoViewIfNeeded();
      await brk.click();
      await cp.locator(`[data-couch-page="break"] [data-week-call="${sid}"]`).waitFor({ timeout: 20_000 });
      await cp.waitForTimeout(600);
      check(/Called it/i.test(await cp.locator(`[data-week-call="${sid}"]`).innerText()) && (await cp.locator("[data-week-poll]").count()) === 2, "Commercial break: ZT Survivor 51's Call it (called) and the couch's two polls", await cp.locator("[data-break-week]").innerText());
      await cp.locator("[data-break-week]").scrollIntoViewIfNeeded();
      await C1.shot("break-this-week");
      await C1.wide("Commercial break");

      // The talk show: Weekly Calls' card on Tonight, and Start a game's sheet.
      await cp.goto(`${BASE}/show/${tk.seasonId}/tonight`, { waitUntil: "load" });
      const done = cp.locator('[data-done^="calls-done-"]');
      await done.waitFor({ timeout: 30_000 });
      await cp.waitForTimeout(800);
      check(/Your calls are in/i.test(await done.innerText()), "the talk show's Tonight: Weekly Calls' card says his calls are in", await done.innerText());
      await C1.shot("talk-tonight");
      await done.getByRole("button", { name: "Change" }).click();
      const tsheet = cp.locator('[data-call-sheet="4"][data-call-status="open"]');
      await tsheet.waitFor({ timeout: 20_000 });
      await cp.waitForTimeout(400);
      check((await tsheet.locator(`[data-call-q="${tq[0].key}"] [data-call-option="yes"][aria-pressed="true"]`).count()) === 1 && /Tonight\?/i.test(await tsheet.innerText()), "Change: the sheet has his two calls", await tsheet.innerText());
      await C1.shot("talk-call-sheet");
      await cp.keyboard.press("Escape");
      await C1.closed();
      await cp.goto(`${BASE}/show/${tk.seasonId}/games`, { waitUntil: "load" });
      await cp.locator(`[data-table="${WC}"]`).waitFor({ timeout: 30_000 });
      await cp.waitForTimeout(600);
      await C1.shot("talk-games");
      check(C1.errors().length === 0, "no page errors (alex, part 2)", C1.errors().join(" | "));
    }

    // ================= part 2, once Episode 6 (and the talk show's 4) have aired =================
    // The season moves four days back: Episode 6 aired a day ago, 7 is in three days. The talk show's 4 aired a day ago.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 3 WHERE id = $1", [tk.seasonId]);
    r = await callIt("riley", 6, { calls: { out: GO.key } });
    check(r.status === 409 && /closed when it started/.test(r.body.error), "once it's aired nobody calls it: 409", JSON.stringify(r.body));
    r = await callsOf("alex", 6);
    check(
      r.body.status === "closed" && r.body.catchUp === 6 && r.body.verdicts === null && r.body.people.length === 0 && r.body.mine.out === GO.key,
      "alex (still on 5): his own calls, nothing of the couch's until he's seen it",
      JSON.stringify(r.body).slice(0, 300)
    );
    for (const who of ["alex", "riley", "jordan"]) await pool.query("UPDATE show_follows SET seen_through = 6 WHERE user_id = $1 AND season_id = $2", [U[who], sid]);
    r = await callsOf("alex", 6);
    const personIn = (body, who) => body.people.find((p) => p.name === u(who));
    check(r.body.verdicts?.out?.state === "waiting" && r.body.verdicts[momentQ.key]?.state === "waiting", "seen, nothing in yet: both calls wait", JSON.stringify(r.body.verdicts));
    check(r.body.people[0]?.name === u("alex") && personIn(r.body, "riley")?.calls.out === STAY.key && personIn(r.body, "jordan")?.calls.out === GO.key && !personIn(r.body, "sam"), "the couch's calls beside his, his first (sam didn't call)", JSON.stringify(r.body.people));
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at) VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now())`,
      [sid, GO.label]
    );
    r = await callsOf("alex", 6);
    check(JSON.stringify(r.body.verdicts?.out) === JSON.stringify({ state: "known", right: [GO.key] }) && r.body.verdicts[momentQ.key].state === "waiting", "who went home is in (early): Who goes home? settled, the moment waits for every result", JSON.stringify(r.body.verdicts));
    check(personIn(r.body, "alex")?.right === 1 && personIn(r.body, "jordan")?.right === 1 && personIn(r.body, "riley")?.right === 0, "alex and jordan called it, riley didn't");
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at) VALUES ($1, 6, 'event', $2, '', $3, 'accepted', true, now())`,
      [sid, STAY.label, momentQ.key.slice(2)]
    );
    r = await callsOf("alex", 6);
    check(JSON.stringify(r.body.verdicts?.[momentQ.key]) === JSON.stringify({ state: "known", right: ["yes"] }) && personIn(r.body, "alex")?.right === 2 && personIn(r.body, "riley")?.right === 0, "every result in: it happened, alex called both", JSON.stringify(r.body.verdicts));
    r = await callsOf("sam", 6);
    check(r.body.status === "closed" && r.body.verdicts === null && r.body.people.length === 0 && r.body.questions.length === 0, "sam (on 3): nothing about Episode 6", JSON.stringify(r.body).slice(0, 200));
    r = await callsOf("casey", 6, sid, X);
    check(r.status === 200 && r.body.verdicts === null && r.body.people.length === 0, "casey (on 5, her own couch): nothing either");
    r = await callIt("alex", 6, { said: { [momentQ.key]: "yes" } });
    check(r.status === 400, "nobody says what happened on a call the results settle: 400");

    // The polls close at airtime: their votes for whoever's seen Episode 6.
    r = await pollsOf("alex");
    p1 = pollIn(r.body, P1);
    // In the browser alex moved his vote to who went home; with --api it stayed on the other.
    const goVotes = apiOnly ? 2 : 3;
    check(!p1.open && p1.votes === 3 && p1.results?.[0]?.key === GO.key && p1.results[0].n === goVotes && p1.results[0].people.length === goVotes, "the poll closed: the couch's votes, most on who went home", JSON.stringify(p1?.results));
    r = await answer("riley", P1, { vote: STAY.key });
    check(r.status === 409, "voting after it closed: 409");
    await pool.query("UPDATE show_follows SET seen_through = 5 WHERE user_id = $1 AND season_id = $2", [U.sam, sid]);
    r = await pollsOf("sam");
    p1 = pollIn(r.body, P1);
    check(!!p1 && !p1.open && p1.results === null && p1.waitsFor === 6, "sam (on 5): it's closed, and its votes wait until he's seen Episode 6", JSON.stringify(p1).slice(-160));
    await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [U.sam, sid]);

    // The talk show: the couch says what happened (two agreeing), and Weekly Calls counts the calls.
    for (const who of ["alex", "riley"]) await pool.query("UPDATE show_follows SET seen_through = 4 WHERE user_id = $1 AND season_id = $2", [U[who], tk.seasonId]);
    r = await callsOf("alex", 4, tk.seasonId);
    check(r.body.status === "closed" && tq.every((x) => r.body.verdicts?.[x.key]?.state === "waiting") && r.body.alone === false, "the talk show's Episode 4: both calls wait for the couch to say", JSON.stringify(r.body.verdicts));
    r = await callIt("alex", 4, { said: { [tq[0].key]: "yes" } }, tk.seasonId);
    check(r.body.says?.[tq[0].key]?.mine === "yes" && r.body.says[tq[0].key].settled === null && r.body.verdicts[tq[0].key].state === "waiting", "alex says it happened: one voice waits for a second", JSON.stringify(r.body.says));
    r = await callIt("riley", 4, { said: { [tq[0].key]: "yes", [tq[1].key]: "no" } }, tk.seasonId);
    check(JSON.stringify(r.body.verdicts?.[tq[0].key]) === JSON.stringify({ state: "known", right: ["yes"] }) && r.body.verdicts[tq[1].key].state === "waiting", "riley agrees: settled; her other say waits", JSON.stringify(r.body.verdicts));
    r = await callIt("alex", 4, { said: { [tq[1].key]: "no" } }, tk.seasonId);
    check(personIn(r.body, "alex")?.right === 2 && personIn(r.body, "riley")?.right === 1, "both settled: alex called 2, riley 1", JSON.stringify(r.body.people));
    r = await as.alex.call("GET", `/api/seasons/${tk.seasonId}/games${q(A)}`);
    wg = r.body.games?.find((g) => g.leagueId === WC);
    check(wg?.through === 4 && wg.table[0]?.name === u("alex") && wg.table[0].total === 2 && wg.table[0].rank === "1" && wg.table[1]?.total === 1, "Weekly Calls' table: alex 2, riley 1, through Episode 4", JSON.stringify(wg?.table));
    check(wg.call?.episode === 5 && wg.call.made === 0, "and his move is Episode 5's calls", JSON.stringify(wg.call));
    home = (await as.alex.call("GET", "/api/me/home")).body;
    check(
      home.moves.filter((m) => m.leagueId === WC).map((m) => m.kind).join() === "calls" && !home.backstage.some((b) => b.leagueId === WC),
      "nothing else to do for it: no results to fill in, no cast to add (it has neither)",
      JSON.stringify({ moves: home.moves.filter((m) => m.leagueId === WC), backstage: home.backstage.filter((b) => b.leagueId === WC) })
    );
    const hubWc = (await hub("alex")).games.find((g) => g.leagueId === WC);
    check(hubWc?.rank === "1" && hubWc.through === 4, "the hub counts it: alex 1st in Weekly Calls", JSON.stringify(hubWc));
    r = await callsOf("sam", 4, tk.seasonId);
    check(r.body.status === "closed" && r.body.verdicts === null && r.body.catchUp === 4, "sam (not following it, on 0): his own call, nothing settled about it");

    // A public pool's Who goes home? and Call it are the same call.
    const soS = so.seasonId;
    await solo.alex.call("POST", `/api/seasons/${soS}/pool`, { action: "join" });
    let pinfo = (await solo.alex.call("GET", `/api/seasons/${soS}/pool`)).body;
    const pcall = pinfo.game?.call;
    check(pcall?.open && pcall.episode === 6 && pcall.of === 1 && pcall.available.length > 2, "the pool: Who goes home? for Episode 6", JSON.stringify(pcall).slice(0, 200));
    const castOfPool = (id) => pinfo.game.cast.find((x) => x.id === id);
    const firstOut = castOfPool(pcall.available[0]);
    r = await solo.alex.call("POST", `/api/seasons/${soS}/pool`, { action: "call", castawayId: firstOut.id });
    c = await solo.alex.call("GET", `/api/seasons/${soS}/calls/6`);
    const soOut = c.body.questions?.find((x) => x.key === "out");
    check(c.body.scope === "solo" && soOut?.options.find((o) => o.key === c.body.mine.out)?.label === firstOut.name, "called from the pool: Call it has it (the same call)", JSON.stringify(c.body.mine));
    const second = soOut.options.find((o) => o.label !== firstOut.name);
    await solo.alex.call("POST", `/api/seasons/${soS}/calls/6`, { calls: { out: second.key } });
    pinfo = (await solo.alex.call("GET", `/api/seasons/${soS}/pool`)).body;
    check(castOfPool(pinfo.game.call.call)?.name === second.label, "called from Call it: the pool has it", JSON.stringify(pinfo.game.call).slice(0, 120));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [soS]);
    await soloFixture.addExit(pool, soS, 6, second.label);
    await pool.query("UPDATE show_follows SET seen_through = 6 WHERE user_id = (SELECT id FROM \"user\" WHERE username = $1) AND season_id = $2", [soloFixture.username("alex"), soS]);
    pinfo = (await solo.alex.call("GET", `/api/seasons/${soS}/pool`)).body;
    check(pinfo.game.you?.calls === 1 && pinfo.game.call?.right === 1, "he went home: one called right on the pool's board", JSON.stringify({ you: pinfo.game.you?.calls, call: pinfo.game.call }));

    if (!apiOnly) {
      // ================= part 2 in the browser, after Episode 6 =================
      const C2 = await browse("alex");
      const pg2 = C2.pg;
      await pg2.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const res = pg2.locator('[data-call-result-row="6"]');
      await res.waitFor({ timeout: 30_000 });
      await pg2.waitForTimeout(800);
      check(/Episode 6: you called 2 of 2/.test(await res.innerText()) && (await pg2.locator('[data-call-row="7"]').count()) === 1, "Tonight's Extras: Episode 6, you called 2 of 2; and Call it for Episode 7", await res.innerText());
      await res.scrollIntoViewIfNeeded();
      await C2.shot("tonight-call-result");
      await res.click();
      const rs = pg2.locator('[data-call-sheet="6"][data-call-results]');
      await rs.waitFor({ timeout: 20_000 });
      await pg2.waitForTimeout(500);
      check(/2\/2/.test(await pg2.locator("[data-call-score]").innerText()) && (await rs.locator('[data-call-result="out"] [data-call-mine="right"]').count()) === 1, "the sheet: 2/2, his Who goes home? right", await pg2.locator("[data-call-score]").innerText());
      check(
        (await rs.locator(`[data-call-result="out"] [data-call-person="${u("riley")}"]`).count()) === 1 && (await rs.locator(`[data-call-result="out"] [data-call-person="${u("jordan")}"]`).count()) === 1,
        "with riley's and jordan's calls beside his"
      );
      check(new RegExp(`${GO.label.split(" ")[0]}.* went home`).test(await rs.locator('[data-call-result="out"] [data-call-answer]').innerText()), "and who went home", await rs.locator('[data-call-result="out"] [data-call-answer]').innerText());
      await C2.shot("call-results");
      await C2.wide("the call sheet's results");
      await pg2.keyboard.press("Escape");
      await C2.closed();
      await pg2.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const prow = pg2.locator(`[data-poll-row="${P1}"][data-poll-open="no"]`);
      await prow.waitFor({ timeout: 30_000 });
      await pg2.waitForTimeout(600);
      await prow.click();
      const pres = pg2.locator(`[data-poll-sheet="${P1}"][data-poll-state="results"]`);
      await pres.waitFor({ timeout: 20_000 });
      await pg2.waitForTimeout(800);
      check((await pres.locator(`[data-poll-result="${GO.key}"]`).getAttribute("data-poll-votes")) === "3" && /3 votes · you're with 100% of the couch/.test(await pg2.locator("[data-poll-line]").innerText()), "the poll's results: all three on who went home", await pg2.locator("[data-poll-line]").innerText());
      await C2.shot("poll-results");
      await pg2.keyboard.press("Escape");
      await C2.closed();
      // The talk show: how the calls went, and Weekly Calls' table.
      await pg2.goto(`${BASE}/show/${tk.seasonId}/tonight`, { waitUntil: "load" });
      const tres = pg2.locator('[data-call-result-row="4"]');
      await tres.waitFor({ timeout: 30_000 });
      await pg2.waitForTimeout(800);
      check(/Episode 4: you called 2 of 2/.test(await tres.innerText()), "the talk show's Tonight: Episode 4, you called 2 of 2", await tres.innerText());
      await tres.click();
      const trs = pg2.locator('[data-call-sheet="4"][data-call-results]');
      await trs.waitFor({ timeout: 20_000 });
      await pg2.waitForTimeout(500);
      check(/The couch says it happened/.test(await trs.innerText()) && /The couch says it didn't/.test(await trs.innerText()), "the sheet: what the couch said happened", await trs.innerText());
      await C2.shot("talk-results");
      await pg2.keyboard.press("Escape");
      await C2.closed();
      await pg2.goto(`${BASE}/show/${tk.seasonId}/games`, { waitUntil: "load" });
      const wrow = pg2.locator(`[data-table="${WC}"] [data-player="${u("alex")}"]`);
      await wrow.waitFor({ timeout: 30_000 });
      await pg2.waitForTimeout(600);
      check(/2\s*$/.test(await wrow.innerText()) && /^1/.test((await wrow.innerText()).trim()), "Weekly Calls' table: alex 1st with 2", await wrow.innerText());
      await C2.shot("talk-table");
      await C2.wide("Weekly Calls' table");
      check(C2.errors().length === 0, "no page errors (alex, after the episode)", C2.errors().join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) {
      await talkFixture.down(pool).catch((e) => console.error(e));
      await soloFixture.down(pool).catch((e) => console.error(e));
      await fixture.down(pool).catch((e) => console.error(e));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
