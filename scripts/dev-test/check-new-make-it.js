// Dev-only check for Make it a game (docs/PLAN-new-design.md step 10 part 2a), against the dev server, on new-fixture.js's
// couch (alex, riley, jordan, sam; casey on a couch of their own), a stand-in for TVmaze (fake-listings.js: ZT Yacht Life,
// a reality series with its crew listed; ZT Grand Prix, a sport with nobody listed; ZT Drop Show, a scripted series with its
// characters; ZT Old Show, a talk show with its regulars; ZT Love Shack, a reality show with nobody listed) and a stand-in for
// our bot (fake-bot.js: "setup" is how a show works, "cast" who's in it), both reached through the dev server's headers.
//   API:
//   - before anything's in: the cast's question, a kind, Looks right and a stray paste refused; the question for how it
//     works starts from the nearest rulebook (a scripted series from Scrubs', a reality show from none);
//   - Ask ChatGPT for me on a reality series: asking (polled as a version), a second tap joins (the bot asked once), how it
//     works then the crew from the TV listing (no second ask); the review: the kind ChatGPT said, the crew with their roles,
//     each episode, what scores, the games that fit, a phase it reached not told to someone who hasn't seen it;
//   - Change: a competition (the listing's crew isn't its cast: Who's in it missing, can't be set up), a scripted series
//     (the listing read as characters), back again; the answer itself never changes;
//   - Looks right: the show set up for everyone (shows.set_up_at, kind, words, its stored format), the season on its own
//     rulebook (made by alex, new until checked, from blocks), the approved season cast; a second Looks right refused; How
//     it works says who made it; classic's show picker lists it now; riley sees alex made it;
//   - a sport: how it works, then the cast's own question (two asks); the bot down; a failed ask kept and asked again; an
//     ask that ran out of time carried on (continue: the cast only);
//   - copy and paste on a scripted series: a name in the answer taken out, what doesn't fit left out and listed, the
//     characters from the listing; an answer that can't be used (Ask again / Start over); a talk show needs no cast;
//   - five a day each.
//   In a real browser at --width (390 by default): alex makes ZT Love Shack a game from the Games tab with Ask ChatGPT for
//   me (asking, then the review), changes the kind and back, opens How it works from the review, Looks right (the plate
//   becomes Play it); then copy and paste on ZT Drop Show from Tonight's plate (Ask an AI's sheet, Check what it found);
//   Tonight's plate again (the ⋯ menu leaves Make it a game to it). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-make-it.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it; its down removes the shows zt_nd
// people added, their rulebooks, casts and stored formats); touches zt rows only; refuses a non-local database. Prints
// PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-make-it runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-make-it.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
/** A library rulebook as ChatGPT would send it for another show: its name, chatter and a code fence around it. */
const answerFrom = (id, show, edit = (b) => b) => {
  const b = edit({ ...clone(LIBRARY[id].blocks), show });
  return `Here's the rulebook for ${show}:\n\`\`\`json\n${JSON.stringify(b, null, 1)}\n\`\`\`\nLet me know if you need anything else.`;
};
const castAnswer = (people) => `\`\`\`json\n${JSON.stringify({ castaways: people.map(([name, group]) => ({ name, photoUrl: "", startingGroup: group })), sources: ["https://example.invalid/cast"] })}\n\`\`\``;

// What the stand-in bot answers, per show (the prompts name it) and kind of question.
const ANSWERS = {
  "ZT Yacht Life": { setup: () => answerFrom("below-deck", "ZT Yacht Life", (b) => ({ ...b, phaseStarts: { charterSeason: 2 } })) },
  "ZT Grand Prix": {
    setup: () => answerFrom("world-series", "ZT Grand Prix"),
    cast: () => castAnswer([["Ana Speed", "Red Team"], ["Bo Lap", "Red Team"], ["Cy Pole", "Blue Team"], ["Di Grid", "Blue Team"], ["Ed Pit", "Green Team"], ["Fi Flag", "Green Team"]]),
  },
  "ZT Love Shack": {
    setup: () => answerFrom("the-amazing-race", "ZT Love Shack"),
    cast: () => castAnswer([["Gia Heart", null], ["Hal Rose", null], ["Ivy Kiss", null], ["Jon Date", null], ["Kay Vow", null], ["Lou Ring", null], ["Max Flirt", null]]),
  },
};
const showIn = (prompt) => Object.keys(ANSWERS).find((name) => prompt.includes(name));

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  const bot = await fakeBot.start({
    delayMs: 600,
    answer: (prompt, kind) => {
      const fn = ANSWERS[showIn(prompt)]?.[kind];
      if (!fn) throw new Error(`no answer for ${kind} about ${showIn(prompt) ?? "?"}`);
      return fn();
    },
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const { rows: couchRows } = await pool.query("SELECT couch_id FROM couch_members WHERE user_id = $1", [fx.users.alex]);
    const couch = couchRows[0].couch_id;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD, headers });
    const add = async (who, listing) => {
      const r = await as[who].call("POST", "/api/me/shows", { listing });
      if (r.status !== 200) throw new Error(`adding ${listing}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body.seasonId;
    };
    const makeUrl = (sid, extra = "") => `/api/seasons/${sid}/make?couch=${couch}${extra}`;
    const get = async (who, sid) => (await as[who].call("GET", makeUrl(sid))).body;
    const post = (who, sid, body) => as[who].call("POST", makeUrl(sid), body);
    const settle = async (who, sid) => {
      for (let i = 0; i < 80; i++) {
        const p = (await as[who].call("GET", `/api/seasons/${sid}/make?poll=1`)).body;
        if (!p.asking) return get(who, sid);
        await new Promise((r) => setTimeout(r, 300));
      }
      return get(who, sid);
    };
    const showRow = async (sid) => (await pool.query("SELECT s.* FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = $1", [sid])).rows[0];
    const setupRow = async (sid) => (await pool.query("SELECT * FROM show_setups WHERE season_id = $1 ORDER BY created_at DESC LIMIT 1", [sid])).rows[0];

    if (!apiOnly) {
      // The browser's shows, added first so they're on alex's list.
      await add("alex", 990001);
      await add("alex", 990004);
    }

    // ---- a reality series, through our bot ----
    const ys = await add("alex", 990011);
    await add("riley", 990011);
    const s0 = await get("alex", ys);
    check(s0.ready === false && s0.setup === null && s0.bot.available === true && s0.v === "none", "a show that isn't a game: nothing started, our bot answering", JSON.stringify(s0).slice(0, 200));
    check((await as.alex.call("GET", makeUrl(ys, "&prompt=cast"))).status === 409, "the cast's question waits for how it works");
    check((await post("alex", ys, { action: "kind", kind: "series" })).status === 409, "no kind to change before an answer");
    check((await post("alex", ys, { action: "confirm" })).status === 409, "nothing to set up yet");
    check((await post("alex", ys, { action: "paste", part: "rules", answer: "I couldn't find that show." })).status === 400, "a paste with no JSON in it is refused");
    await post("alex", ys, { action: "restart", part: "all" });
    const rulesQ = (await as.alex.call("GET", makeUrl(ys, "&prompt=rules"))).body;
    check(/ZT Yacht Life/.test(rulesQ.prompt) && !/Start from this rulebook/.test(rulesQ.prompt), "how it works' question: about this show, and a reality show the listings can't tell apart starts from nothing");

    bot.delayMs = 1500;
    const asked0 = bot.asked.length;
    const a1 = await post("alex", ys, { action: "ask" });
    check(a1.status === 200 && a1.body.setup?.asking === true && a1.body.setup.stage === "rules" && a1.body.setup.mine === true, "Ask ChatGPT for me: asking how it works", JSON.stringify(a1.body.setup));
    const poll = (await as.alex.call("GET", `/api/seasons/${ys}/make?poll=1`)).body;
    check(poll.asking === true && typeof poll.v === "string" && Object.keys(poll).sort().join() === "asking,stage,v", "what the page polls: a version, asking, the stage", JSON.stringify(poll));
    const a2 = await post("riley", ys, { action: "ask" });
    check(a2.status === 200 && a2.body.setup?.id === a1.body.setup.id && a2.body.setup.mine === false && a2.body.setup.by === "zt_nd_alex", "riley's tap joins alex's ask (alex named: same couch)", JSON.stringify(a2.body.setup));
    const r1 = await settle("alex", ys);
    const asked = bot.asked.slice(asked0).map((q) => q.kind);
    check(asked.join() === "setup", "the bot asked once: how it works (the crew came from the TV listing)", asked.join());
    check(r1.setup?.stage === "ready" && r1.setup.asking === false && r1.review?.approvable === true, "ready to check", JSON.stringify(r1.setup));
    const rv = r1.review;
    check(rv.kind.key === "series" && rv.kind.start === "reality" && rv.kind.name === "A series · reality" && rv.kind.changed === false, "the kind ChatGPT said: a series, reality", JSON.stringify(rv.kind));
    check(rv.cast.count === 5 && rv.cast.unit === "crew members" && rv.cast.faces.some((f) => f.name === "Cap Rivers" && f.line === "Captain") && rv.cast.faces.some((f) => f.name === "Ash Deck" && f.line === "From the TV listing"), "the crew from the TV listing, with their roles", JSON.stringify(rv.cast.faces.slice(0, 2)));
    check(r1.setup.found.length === 4 && /^5 crew members$/.test(r1.setup.found[0]) && /^How an episode runs: 6 parts$/.test(r1.setup.found[1]) && r1.setup.found[3] === "A series · reality", "what it found, a line each", r1.setup.found.join(" | "));
    check(rv.how.rundown.segments.length === 6 && rv.how.games.map((g) => g.name).join() === "Weekly Lineup", "each episode, and the games that fit a series", rv.how.games.map((g) => g.name).join());
    const charter = rv.how.season.phases.find((p) => p.id === "charterSeason");
    check(charter && charter.started === false && !/Episode 2/.test(charter.when), "a phase the season reached isn't told to someone who hasn't seen it", JSON.stringify(charter));
    const riley1 = await get("riley", ys);
    check(riley1.review?.kind.key === "series", "riley sees the same review");

    // Change
    const before = (await setupRow(ys)).rules_answer;
    const k1 = await post("alex", ys, { action: "kind", kind: "competition" });
    check(k1.status === 200 && k1.body.review.kind.key === "competition" && k1.body.review.kind.changed === true && k1.body.review.needsCast === true && k1.body.review.approvable === false && k1.body.setup.stage === "cast",
      "a competition: the listing's crew isn't its cast, so who's in it is missing", JSON.stringify(k1.body.review?.kind));
    // What fits is the rulebook's (step 10 part 2b, rulebook-fits.js): nobody goes home each charter and nobody wins.
    check(k1.body.review.how.games.map((g) => g.name).join() === "Weekly Lineup", "as a competition only Weekly Lineup fits: nobody goes home each episode, and its finale still crowns nobody, as ChatGPT said", k1.body.review.how.games.map((g) => g.name).join());
    check((await post("alex", ys, { action: "confirm" })).status === 409, "and it can't be set up like that");
    const k2 = await post("alex", ys, { action: "kind", kind: "series", start: "scripted" });
    check(k2.body.review.kind.name === "A series · scripted" && k2.body.review.cast.faces.some((f) => f.name === "Captain" && f.line === "Cap Rivers"), "a scripted series: the listing read as characters", JSON.stringify(k2.body.review.cast.faces[0]));
    const k3 = await post("alex", ys, { action: "kind", kind: "series", start: "reality" });
    check(k3.body.review.kind.changed === false && k3.body.review.cast.faces.some((f) => f.name === "Cap Rivers") && k3.body.review.approvable === true, "back to what ChatGPT said");
    check((await setupRow(ys)).rules_answer === before, "the answer itself never changed");

    // Looks right
    const c1 = await post("alex", ys, { action: "confirm" });
    check(c1.status === 200 && c1.body.ready === true, "Looks right: it's a game", JSON.stringify(c1.body).slice(0, 160));
    const show = await showRow(ys);
    check(!!show.set_up_at && show.kind === "series" && show.format === `made-${show.slug}` && show.castaway_term === "Crew member", "the show: set up, a series, playing by its own stored format, its words", `${show.kind} ${show.format} ${show.castaway_term}`);
    const { rows: fmt } = await pool.query("SELECT status, data->>'id' AS id FROM show_formats WHERE id = $1", [show.format]);
    check(fmt[0]?.status === "approved" && fmt[0].id === show.format, "its stored format is approved, the compiled rules");
    const { rows: ss } = await pool.query("SELECT * FROM show_seasons WHERE id = $1", [ys]);
    const { rows: book } = await pool.query("SELECT * FROM rulebooks WHERE id = $1", [ss[0].rulebook_id]);
    check(
      ss[0].rulebook_live === true && book[0]?.owner_kind === "season" && book[0].status === "in_force" && book[0].compiled_source === "blocks" && book[0].review_status === "unreviewed" && book[0].created_by === fx.users.alex && book[0].provenance.from === "made" && book[0].provenance.via === "bot" && book[0].kind === "series",
      "the season's rulebook: made by alex from blocks, new until checked, and the season plays by it",
      JSON.stringify({ live: ss[0].rulebook_live, ...book[0], blocks: undefined, compiled: undefined }).slice(0, 300)
    );
    check(JSON.stringify(book[0].compiled).length > 100 && book[0].compiled.id === show.format && book[0].phase_starts.charterSeason === 2, "compiled, with the phase it reached");
    const { rows: cast } = await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [ys]);
    check(cast.length === 5 && cast[0].name === "Cap Rivers" && !!ss[0].cast_approved_at && ss[0].cast_approved_by === fx.users.alex && ss[0].cast_size === 5 && !!ss[0].cast_locked_at, "the season's cast, approved and finished", cast.map((c) => c.name).join());
    check((await setupRow(ys)).done_by === fx.users.alex, "the attempt is kept as who set it up");
    const { rows: desk } = await pool.query("SELECT text FROM admin_changes WHERE entity = 'rulebook' AND entity_id = $1", [book[0].id]);
    check(/ZT Yacht Life 2 made a game \(Ask ChatGPT for me\): a series · reality, 5 in the cast/.test(desk[0]?.text ?? ""), "the desk's History has it", desk[0]?.text);
    check((await post("riley", ys, { action: "confirm" })).status === 409, "a second Looks right is refused: it's a game already");
    const r2 = await get("riley", ys);
    check(r2.ready === true && r2.madeBy === "zt_nd_alex" && r2.setup === null, "riley: it's a game, alex set it up", JSON.stringify(r2).slice(0, 160));
    const how = (await as.alex.call("GET", `/api/seasons/${ys}/how-it-works?couch=${couch}`)).body;
    check(how.how?.lineage === "Made with ChatGPT by zt_nd_alex · new until another couch checks it" && how.how.kind.key === "series" && how.cast.length === 5, "How it works: made by alex, new until another couch checks it", how.how?.lineage);
    const picker = (await as.casey.call("GET", "/api/shows")).body.shows;
    check(picker.some((p) => p.slug === show.slug), "classic's show picker lists it now");
    const space = (await as.alex.call("GET", `/api/seasons/${ys}/space?couch=${couch}`)).body;
    check(space.ready === true, "the show space says it's a game");

    // ---- a sport: two questions ----
    const gp = await add("jordan", 990012);
    bot.delayMs = 300;
    const asked1 = bot.asked.length;
    await post("jordan", gp, { action: "ask" });
    const g1 = await settle("jordan", gp);
    check(bot.asked.slice(asked1).map((q) => q.kind).join() === "setup,cast", "a sport: how it works, then who's in it (nobody listed)", bot.asked.slice(asked1).map((q) => q.kind).join());
    check(g1.review?.kind.key === "sport" && g1.review.cast.count === 6 && g1.review.cast.faces[0].line === "Red Team" && g1.setup.found[0] === "6 players in 3 teams", "six players in their teams", JSON.stringify(g1.setup?.found));
    check(g1.review.how.games.map((g) => g.name).join() === "Weekly Lineup,Survival Pool", "a sport fits Weekly Lineup and Survival Pool");
    // The ask ran out of time between its two questions: the page carries on with the cast only.
    await pool.query("UPDATE show_setups SET cast_answer = NULL, cast_from = NULL, stage = 'cast', asking_at = NULL WHERE season_id = $1 AND done_at IS NULL", [gp]);
    const asked2 = bot.asked.length;
    const cont = await post("jordan", gp, { action: "continue" });
    check(cont.status === 200 && cont.body.setup.asking === true && cont.body.setup.stage === "cast", "carrying on: asking who's in it", JSON.stringify(cont.body.setup));
    const g2 = await settle("jordan", gp);
    check(bot.asked.slice(asked2).map((q) => q.kind).join() === "cast" && g2.review.cast.count === 6, "only the cast was asked again");
    // Its players already in from its linked games (sports/cast.ts: ESPN's rosters): taken from there, ChatGPT never asked.
    await pool.query(
      `INSERT INTO season_cast (season_id, name, tribe_name, role, provider_ids, sort_order) VALUES
         ($1, 'Zt Pitcher', 'Zt Blue Sox', 'Pitcher', '{"espn":"zt1"}', 0), ($1, 'Zt Catcher', 'Zt Blue Sox', 'Catcher', '{"espn":"zt2"}', 1),
         ($1, 'Zt Shortstop', 'Zt Red Birds', 'Shortstop', '{"espn":"zt3"}', 2)`,
      [gp]
    );
    await post("jordan", gp, { action: "restart", part: "cast" });
    const asked3 = bot.asked.length;
    await post("jordan", gp, { action: "ask" });
    const g3 = await settle("jordan", gp);
    check(
      bot.asked.length === asked3 && g3.review?.cast.count === 3 && g3.review.cast.faces.map((f) => `${f.name}/${f.line}`).join() === "Zt Pitcher/Zt Blue Sox,Zt Catcher/Zt Blue Sox,Zt Shortstop/Zt Red Birds",
      "a sport whose players came in from its games: who's in it from there, ChatGPT not asked",
      JSON.stringify({ asked: bot.asked.slice(asked3).map((q) => q.kind), cast: g3.review?.cast })
    );
    await pool.query("DELETE FROM season_cast WHERE season_id = $1 AND name LIKE 'Zt %'", [gp]);
    // A failed ask is kept, and asked again.
    await post("jordan", gp, { action: "restart", part: "all" });
    const failing = ANSWERS["ZT Grand Prix"].setup;
    ANSWERS["ZT Grand Prix"].setup = () => "Sorry, I can't help with that.";
    await post("jordan", gp, { action: "ask" });
    const f1 = await settle("jordan", gp);
    check(f1.setup?.stage === "failed" && /no JSON|can't be read|something else/i.test(f1.setup.message ?? ""), "an answer with nothing in it: failed, saying why", f1.setup?.message);
    ANSWERS["ZT Grand Prix"].setup = failing;
    await post("jordan", gp, { action: "ask" });
    const f2 = await settle("jordan", gp);
    check(f2.setup?.stage === "ready" && f2.review?.approvable === true, "asked again: ready");
    bot.down = true;
    await post("jordan", gp, { action: "restart", part: "all" });
    const downR = await post("jordan", gp, { action: "ask" });
    check(downR.status === 503 && /Copy and paste works/.test(downR.body.error ?? ""), "our bot down: copy and paste works", JSON.stringify(downR.body));
    bot.down = false;

    // ---- copy and paste: a scripted series ----
    const ds = apiOnly ? await add("sam", 990004) : (await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.tvmaze_id = 990004")).rows[0].id;
    if (!apiOnly) await add("sam", 990004);
    const dq = (await as.sam.call("GET", makeUrl(ds, "&prompt=rules"))).body;
    check(/ZT Drop Show/.test(dq.prompt) && /Start from this rulebook/.test(dq.prompt) && /"Scrubs"|Sacred Heart|character/.test(dq.prompt), "a scripted series' question starts from Scrubs' rulebook");
    const dropAnswer = answerFrom("scrubs", "ZT Drop Show", (b) => ({
      ...b,
      premise: "Nora Vale runs the ward until the finale.",
      customMoments: [...(b.customMoments || []), { id: "wins", label: "Wins an award", counted: "sometimes", answeredBy: "research" }],
    }));
    const p1 = await post("sam", ds, { action: "paste", part: "rules", answer: dropAnswer });
    check(p1.status === 200 && p1.body.setup.via === "paste" && p1.body.setup.stage === "ready", "pasted how it works: ready (the characters came from the listing)", JSON.stringify(p1.body.setup));
    const dr = p1.body.review;
    check(dr.cast.faces.some((f) => f.name === "Nora Vale" && f.line === "Lee Actor"), "the characters, with who plays them", JSON.stringify(dr.cast.faces));
    check(!dr.how.premise || !/Nora/.test(dr.how.premise), "a name in the answer is taken out (a rulebook is read before anyone's watched)", dr.how.premise);
    check(dr.dropped.includes("Wins an award") && dr.approvable === true, "what doesn't fit is left out and listed", dr.dropped.join());
    check((await as.sam.call("GET", makeUrl(ds, "&prompt=cast"))).status === 200, "the cast's question is there too, once how it works is in");
    await post("sam", ds, { action: "restart", part: "all" });
    const bad = await post("sam", ds, { action: "paste", part: "rules", answer: answerFrom("scrubs", "ZT Drop Show", (b) => ({ ...b, cast: { ...b.cast, unit: "robots" } })) });
    check(bad.status === 200 && bad.body.review.approvable === false && bad.body.review.problems.length > 0, "an answer that can't be used says why", JSON.stringify(bad.body.review?.problems));
    check((await post("sam", ds, { action: "confirm" })).status === 409, "and can't be set up");
    const rs = await post("sam", ds, { action: "restart", part: "all" });
    check(rs.body.setup === null, "Start over");

    // ---- a talk show needs no cast; five a day ----
    const os = await add("casey", 990005);
    await pool.query(
      `INSERT INTO show_setups (season_id, started_by, via, stage, done_at)
       SELECT ss.id, $1, 'paste', 'done', now() FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug IN ('zt-nd-survivor', 'zt-nd-traitors')`,
      [fx.users.casey]
    );
    const { rows: some } = await pool.query("SELECT count(*)::int AS n FROM show_setups WHERE started_by = $1", [fx.users.casey]);
    for (let i = some[0].n; i < 5; i++) await pool.query("INSERT INTO show_setups (season_id, started_by, via, stage, done_at) VALUES ($1, $2, 'paste', 'done', now())", [ys, fx.users.casey]);
    const cap = await post("casey", os, { action: "paste", part: "rules", answer: answerFrom("saturday-night-live", "ZT Old Show") });
    check(cap.status === 429, "five a day each", JSON.stringify(cap.body));
    await pool.query("DELETE FROM show_setups WHERE started_by = $1 AND done_at IS NOT NULL", [fx.users.casey]);
    const talk = await post("casey", os, { action: "paste", part: "rules", answer: answerFrom("saturday-night-live", "ZT Old Show") });
    check(talk.status === 200 && talk.body.review.kind.key === "talk" && talk.body.review.needsCast === false && talk.body.review.approvable === true && talk.body.review.cast.count === 3, "a talk show: the regulars from the listing, and no cast needed", JSON.stringify(talk.body.review?.cast));
    check(talk.body.review.how.games.map((g) => g.name).join() === "Weekly Bingo,Weekly Calls", "talk fits Weekly Bingo and Weekly Calls");

    if (!apiOnly) {
      // ---- the browser ----
      const hideBadge = (ctx) =>
        ctx.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => {
            const s = document.createElement("style");
            s.textContent = "nextjs-portal{display:none!important}";
            document.head.appendChild(s);
          });
        });
      const errors = [];
      const A = await open({ user: "zt_nd_alex", pass: PASSWORD, width, motion: "off", headers });
      close = A.close;
      const page = A.page;
      await hideBadge(page.context());
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
      page.on("pageerror", (e) => errors.push(e.message));
      let n = 0;
      const shot = async (name) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where) => {
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
      };
      const toasted = async (re) => {
        try {
          await page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
        } catch {
          /* the text says what came instead */
        }
        return ((await page.locator("[role=status]").textContent().catch(() => "")) || "").trim();
      };
      const sheet = () => page.locator("[role=dialog][data-open]");
      const makeView = (v) => page.locator(`[data-make-view="${v}"]`);

      const ls = (await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.tvmaze_id = 990001")).rows[0].id;
      bot.delayMs = 2500;
      await page.goto(`${BASE}/show/${ls}/games`);
      await page.locator('[data-play-it="make"] [data-make-it]').waitFor({ timeout: 30_000 });
      check(/Not a game yet/i.test(await page.locator('[data-play-it="make"]').innerText()), "the Games tab: Make ZT Love Shack 1 a game");
      await page.locator("[data-make-it]").click();
      await makeView("ask").waitFor({ timeout: 15_000 });
      check(new URL(page.url()).searchParams.get("page") === "make", "Make it a game is pushed over the show (?page=make)");
      check((await page.locator("[data-make-ask]").count()) === 1 && (await page.locator("[data-make-paste]").count()) === 1, "Ask ChatGPT for me leads, copy and paste behind it");
      await fits("Make it a game");
      await shot("make-ask");
      await page.locator("[data-make-ask]").click();
      await makeView("asking").waitFor({ timeout: 15_000 });
      await shot("make-asking");
      await page.locator('[data-make-found] li:has-text("Who\'s in it")').waitFor({ timeout: 20_000 }).catch(() => {});
      check(/A competition|things that score/.test(await page.locator("[data-make-found]").innerText()), "what it found shows as it comes in");
      await shot("make-asking-cast");
      await makeView("review").waitFor({ timeout: 30_000 });
      const kindLine = page.locator("[data-kind-line]");
      check((await kindLine.getAttribute("data-kind-line")) === "competition" && /A competition/.test(await kindLine.innerText()), "the review: the kind as one line, a competition", await kindLine.innerText());
      check((await page.locator("[data-make-cast] > div").count()) === 6 && /\+1 more/.test(await page.locator('[data-make-view="review"]').innerText()), "the cast: six, +1 more");
      check(/Survival Pool, Weekly Lineup, Outlast/.test(await page.locator("[data-make-games]").innerText()), "you can play all three");
      await fits("the review");
      await shot("make-review");
      await page.locator("[data-make-ok]").scrollIntoViewIfNeeded();
      await shot("make-review-foot");
      // Change, and back
      await kindLine.click();
      await sheet().locator("[data-kind-sheet]").waitFor();
      check(/our guess/.test(await sheet().locator('[data-kind="competition"]').innerText()), "What kind of show?: ChatGPT's guess marked");
      await sheet().locator('[data-kind="series"]').click();
      await sheet().locator('[data-start="scripted"]').click();
      await shot("make-kind-sheet");
      await sheet().locator("[data-kind-use]").click();
      await page.waitForFunction(() => document.querySelector("[data-kind-line]")?.getAttribute("data-kind-line") === "series", null, { timeout: 15000 }).catch(() => {});
      check(/A series · scripted/.test(await kindLine.innerText()) && /Weekly Lineup/.test(await page.locator("[data-make-games]").innerText()) && !/Outlast/.test(await page.locator("[data-make-games]").innerText()), "a scripted series: Weekly Lineup only", await kindLine.innerText());
      await kindLine.click();
      await sheet().locator('[data-kind="competition"]').click();
      await sheet().locator("[data-kind-use]").click();
      await page.waitForFunction(() => document.querySelector("[data-kind-line]")?.getAttribute("data-kind-line") === "competition", null, { timeout: 15000 }).catch(() => {});
      check((await kindLine.getAttribute("data-kind-line")) === "competition", "and back to a competition");
      // How it works on the answers
      await page.locator("[data-make-how-link]").click();
      await page.locator("[data-make-how] [data-jump-to]").first().waitFor({ timeout: 15_000 });
      check(new URL(page.url()).searchParams.get("page") === "make-how", "See how the whole season works");
      await shot("make-how");
      await page.goBack();
      await makeView("review").waitFor();
      await page.locator("[data-make-ok]").click();
      check(/ZT Love Shack 1 is a game · every couch can play it/.test(await toasted(/is a game/)), "Looks right: the toast");
      await page.waitForFunction(() => !new URL(location.href).searchParams.get("page"), null, { timeout: 15000 }).catch(() => {});
      await page.locator('[data-play-it="play"]').waitFor({ timeout: 15_000 }).catch(() => {});
      check((await page.locator('[data-play-it="play"]').count()) === 1 && (await page.locator("[data-not-a-game]").count()) === 0, "the page closes, the plate is Play it, and Not a game yet is gone");
      check(!!(await showRow(ls)).set_up_at, "set up in the database");
      await fits("the Games tab after");
      await shot("games-after");

      // Copy and paste from Tonight, on the scripted series.
      await page.goto(`${BASE}/show/${ds}/tonight`);
      await page.locator('[data-play-it="make"] [data-make-it]').waitFor({ timeout: 30_000 });
      await page.locator("[data-make-it]").click();
      await makeView("ask").waitFor();
      await page.locator("[data-make-paste]").click();
      await makeView("paste").waitFor();
      await shot("make-paste");
      await page.locator('[data-make-open="rules"]').click();
      await sheet().locator('[data-ask-ai="make-rules"]').waitFor();
      await sheet().locator("[data-ai-open]:not([aria-disabled=true])").waitFor({ timeout: 15000 }).catch(() => {});
      await shot("make-paste-sheet");
      await sheet().locator("[data-ai-copy]").click();
      const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      check(/ZT Drop Show/.test(copied) && /as a rulebook for a fantasy game/.test(copied), "Copy the question: how ZT Drop Show works");
      await sheet().locator("[data-ai-answer]").fill(answerFrom("scrubs", "ZT Drop Show"));
      check((await sheet().locator('[data-ai-check="ok"]').count()) === 1, "the answer looks whole");
      await sheet().locator("[data-ai-use]").click();
      check(/Got how it works/.test(await toasted(/Got how/)), "pasted: got how it works");
      await page.locator('[data-make-step="2"][data-done]').waitFor({ timeout: 15_000 }).catch(() => {});
      check((await page.locator('[data-make-step="1"][data-done]').count()) === 1 && (await page.locator('[data-make-step="2"][data-done]').count()) === 1, "both steps done: the characters came from the TV listing");
      await shot("make-paste-done");
      await page.locator("[data-make-check]").click();
      await makeView("review").waitFor();
      check(/A series · scripted/.test(await page.locator("[data-kind-line]").innerText()) && /Nora Vale/.test(await page.locator("[data-make-cast]").innerText()), "the review: a scripted series, its characters");
      await fits("the pasted review");
      await shot("make-paste-review");

      // On a show that isn't a game: Tonight's plate carries Make it a game, so the ⋯ menu doesn't repeat it.
      await page.goto(`${BASE}/show/${ds}/tonight`);
      await page.locator("[data-make-it]").first().waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: /Show menu/ }).click();
      await sheet().getByText("Notifications").waitFor();
      check((await sheet().getByText("Make it a game", { exact: true }).count()) === 0, "the ⋯ menu doesn't repeat Make it a game");
      await shot("menu-make");
      await page.keyboard.press("Escape");
      await page.locator("[data-make-it]").first().click();
      await makeView("review").waitFor({ timeout: 15_000 });
      check(true, "Tonight's plate opens Make it a game where it was left (the review)");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } finally {
    await close().catch(() => {});
    await tv.close();
    await bot.close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall good");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
