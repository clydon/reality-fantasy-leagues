// Dev-only check for the maker editing a made game's scoring (docs/PLAN-maker-scoring.md), against the dev server, on
// castle-fixture.js (zt_ra_ people; ZT Castle Game made a game on the researched Traitors rulebook, nobody playing it), a
// stand-in for TVmaze (fake-listings.js) and one for our bot (fake-bot.js), whose full answers say yes to whichever of this
// check's new questions the prompt asks, for Eli Hall.
//   Step 1 (research and the Players tab read the season's rulebook as it is now):
//   - An edit that fixes the rules from the premiere adds "Cried at the Round Table" (a new question, 3 points); one where the
//     show changed from Episode 2 adds "Broke down at breakfast" (another, 2 points).
//   - Episode 1 is asked the first, Episode 2 both (the prompt reads the rulebook with its
//     edits, not the format stored when it was made); the answers count (Eli's events, accepted).
//   - The Players tab has a stat for each (the second added by an edit: the stats read the rulebook with its edits), and
//     Eli's points include them.
//   Step 3 (the maker's scoring, read and saved): points recounted at once, a moment from an answer already asked, one with a
//   question of its own, refusals, someone else read-only, a game on the season read-only.
//   Step 5 (looking them up again): "Wore a cloak" leaves Episodes 1-2 behind; Just the new question asks them for the core
//   fields and that question only, and every earlier result still counts; an episode with every answer is done without
//   asking; Everything again asks the whole checklist, merged.
//   Step 4 (with <outDir>, a real browser): the Scoring page, its way in, a save, Add a moment, the re-run sheet, the line
//   while episodes are behind or asked again, and the Episodes tab's roll call saying what they're asked again for.
//   Step 6 (docs/PLAN-start-a-game-gpt.md S2 part 2): a Survivor season made today (season 993, zt-maker-survivor: Survivor's
//   blocks compiled, under its aliases): the page lists each moment by its own id and keeps both worths of one worth more on
//   several teams, an event id is refused; in the browser, + moves both, says what they were, and they save whole.
//
//   npm run dev                                                  (in another terminal; CRON_SECRET in .env.local)
//   node scripts/dev-test/check-maker-scoring.js [<outDir> [--width=390] [--theme=light|dark]] [--keep]   (<outDir>: the browser half too)
//   node scripts/dev-test/check-maker-scoring.js down            (removes what it made)
//
// It drives the bot's clock route, which plans every season: it stops before calling it if anything that isn't its own is
// due locally. Touches zt rows only (step 6's season rulebook brings Survivor's library template up to date if Survivor's
// rules moved, as any season read in the app does); refuses a non-local database. Prints PASS/FAIL. Shares castle-fixture.js with
// check-research-asks.js: never run the two at once.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { open, api, BASE } = require("./browser");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const fx = require("./castle-fixture");
const Rulebooks = require("../../db/rulebooks.js");
const { diffBlocks, blocksAt } = require("../../src/lib/game/formats/rulebook-patch.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-maker-scoring runs against a local database only");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
// <outDir>: the browser half too, its screenshots there, at --width (390) and --theme=light|dark.
const out = args.find((a) => !a.startsWith("--") && a !== "down") || null;
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const theme = (args.find((a) => a.startsWith("--theme=")) || "").slice(8) || null;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// This check's new moments (each with a question of its own) and who they happen to.
const CRIED = { id: "criedAtRoundTable", label: "Cried at the Round Table", question: "Did they cry at the Round Table?", counted: "yesNo", answeredBy: "research" };
const BROKE = { id: "brokeDownAtBreakfast", label: "Broke down at breakfast", question: "Did they break down at breakfast?", counted: "yesNo", answeredBy: "research" };
const WORE = { id: "woreACloak", label: "Wore a cloak" };
const WHO = "Eli Hall";

// Step 6: a Survivor season made today (993, named zt-maker-survivor, on the real Survivor show), its rulebook made as every
// new one is (db/rulebooks.js ensureSeasonRulebook: Survivor's blocks compiled), the watcher its maker.
const SURVIVOR_SEASON = { number: 993, name: "zt-maker-survivor" };
const dropSurvivor = (pool) => pool.query("DELETE FROM show_seasons WHERE season_number = $1 AND name = $2", [SURVIVOR_SEASON.number, SURVIVOR_SEASON.name]);
async function freshSurvivor(pool) {
  await dropSurvivor(pool);
  const { rows } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, episode_count) SELECT id, $1, $2, 'airing', 6 FROM shows WHERE slug = 'survivor' RETURNING id`,
    [SURVIVOR_SEASON.number, SURVIVOR_SEASON.name]
  );
  const { row } = await Rulebooks.ensureSeasonRulebook(pool, rows[0].id);
  await pool.query(`UPDATE rulebooks SET created_by = (SELECT id FROM "user" WHERE username = 'zt_ra_watcher') WHERE id = $1`, [row.id]);
  return rows[0].id;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (args[0] === "down") {
    await dropSurvivor(pool);
    await fx.down(pool);
    await pool.end();
    console.log("down: zt_ra_ people and the show 990041 removed");
    return;
  }
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local: the bot's clock route needs it");
  const tv = await fakeListings.start({ shows: [...fakeListings.shows(), fx.castleShow()] });
  const bot = await fakeBot.start({
    answer: (prompt, kind) =>
      kind === "full"
        ? fx.fullAnswer(prompt, (a) => {
            const eli = a.castaways.find((c) => c.name === WHO);
            for (const m of [CRIED, BROKE, WORE]) if (eli && m.id in eli) eli[m.id] = "yes";
            // At the Round Table, with two votes against them (what a moment scored per vote counts).
            if (eli && "roundTableVotesReceived" in eli) Object.assign(eli, { roundTableAttended: "yes", roundTableVotesReceived: 2 });
          }).text
        : fx.answer(prompt, kind),
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  const cron = async (method) => {
    const r = await fetch(`${BASE}/api/cron/bot-research`, { method, headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...headers } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const tick = async () => {
    const due = (await cron("GET")).body?.due ?? [];
    const others = due.filter((d) => d.season !== fx.SLUG);
    if (others.length) throw new Error(`something else is due locally (${others.map((d) => `${d.season} ${d.slot}`).join(", ")}): the clock would run it`);
    if (!due.length) return null;
    const r = await cron("POST");
    if (r.status !== 200) throw new Error(`the clock: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  try {
    await fx.up(pool);
    const as = {};
    for (const who of fx.PEOPLE) as[who] = await api({ user: `zt_ra_${who}`, pass: fx.PASSWORD, headers });
    const sid = await fx.makeGame(as.watcher, { seen: 4 });
    const book = (await pool.query("SELECT r.id, r.blocks, r.version FROM rulebooks r JOIN show_seasons ss ON ss.rulebook_id = r.id WHERE ss.id = $1", [sid])).rows[0];
    check(!!book, "made a game: the season plays by its own rulebook");

    // ---- step 1: research and the Players tab read the rulebook as it is now ----
    // A fix from the premiere (the desk's fix: a new base), then a change from Episode 2 (an in-force edit).
    const fixed = { ...book.blocks, customMoments: [...(book.blocks.customMoments || []), CRIED], points: { ...book.blocks.points, [CRIED.id]: 3 } };
    const saved = await Rulebooks.saveChain(pool, book.id, { blocks: fixed });
    check(saved && !("refused" in saved), "a fix adds Cried at the Round Table (3 points)", JSON.stringify(saved?.refused));
    const changed = { ...fixed, customMoments: [...fixed.customMoments, BROKE], points: { ...fixed.points, [BROKE.id]: 2 } };
    await pool.query(
      `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, reach, source, base_version)
       VALUES ($1, 'show_changed', 2, 'in_force', $2::jsonb, 'Broke down at breakfast', 'everyone', 'admin', $3)`,
      [book.id, JSON.stringify(diffBlocks(fixed, changed)), book.version + 1]
    );
    const chained = await Rulebooks.saveChain(pool, book.id, {});
    check(chained && !("refused" in chained), "the show changed from Episode 2: Broke down at breakfast (2 points)", JSON.stringify(chained?.refused));
    const atTwo = blocksAt(fixed, [{ fromEpisode: 2, ops: diffBlocks(fixed, changed) }], 2);
    check(atTwo.customMoments.some((m) => m.id === BROKE.id), "(the edit applies from Episode 2)");

    // Ask for Episodes 1-4's results, and run 1 and 2 on the clock.
    const asked = await as.watcher.call("POST", `/api/seasons/${sid}/recaps`, { action: "ask" });
    check(asked.status === 200 && asked.body.results?.asked?.length === 4, "Episodes 1-4 asked", JSON.stringify(asked.body?.results));
    const r1 = await tick();
    const r2 = await tick();
    check(r1?.job?.episode === 1 && r1.ok && r2?.job?.episode === 2 && r2.ok, "the clock: Episodes 1 and 2 in", JSON.stringify([r1?.message, r2?.message]));
    const fulls = bot.asked.filter((q) => q.kind === "full");
    const p1 = fulls.find((q) => fx.skeletonOf(q.prompt).n === 1)?.prompt ?? "";
    const p2 = fulls.find((q) => fx.skeletonOf(q.prompt).n === 2)?.prompt ?? "";
    // The question reads the moment's name ("Cried at the Round Table, this episode: yes, no, or unknown"). A change from
    // Episode 2 is asked of Episode 1 too (the compiled rules list every question; only their rules know when they start:
    // BACKLOG), but nothing it answers there counts (below).
    check(p1.includes(CRIED.id) && p1.includes(CRIED.label), "Episode 1's question asks the fix's new question (by the rulebook as it is, not the format stored when it was made)");
    check(p2.includes(CRIED.id) && p2.includes(BROKE.id), "Episode 2's asks both");
    const { rows: ev } = await pool.query(
      "SELECT episode_number AS ep, event_type, status FROM season_decisions WHERE season_id = $1 AND castaway_name = $2 AND event_type = ANY($3) ORDER BY 1, 2",
      [sid, WHO, [CRIED.id, BROKE.id]]
    );
    const has = (ep, id) => ev.some((e) => e.ep === ep && e.event_type === id && e.status === "accepted");
    check(has(1, CRIED.id) && has(2, CRIED.id) && has(2, BROKE.id) && !has(1, BROKE.id), "the answers count: Eli cried in 1 and 2, broke down in 2", JSON.stringify(ev));

    const st = (await as.watcher.call("GET", `/api/seasons/${sid}/stats`)).body;
    const keys = (st?.stats ?? []).map((s) => s.key);
    check(st?.through === 2 && keys.includes(CRIED.id) && keys.includes(BROKE.id), "the Players tab: a stat for each, the change's included (the rulebook with its edits)", JSON.stringify(keys));
    const eli = st?.cast?.find((c) => c.name === WHO);
    check(eli?.counts?.[CRIED.id] === 2 && eli?.counts?.[BROKE.id] === 1 && eli.points >= 3 * 2 + 2, "Eli's counts and points include them", JSON.stringify(eli && { counts: eli.counts, points: eli.points }));

    // ---- step 3: the maker's scoring, read and saved ----
    const scoring = (who) => as[who].call("GET", `/api/seasons/${sid}/scoring`);
    const save = (who, body) => as[who].call("POST", `/api/seasons/${sid}/scoring`, body);
    const stats = async () => (await as.watcher.call("GET", `/api/seasons/${sid}/stats`)).body;
    const asksBefore = bot.asked.length;
    const page = (await scoring("watcher")).body;
    const moment = (p, id) => p?.groups?.flatMap((g) => g.moments).find((m) => m.id === id);
    check(page?.editable === true && moment(page, "missionWon")?.points === 2 && moment(page, CRIED.id)?.custom && page.researched.join() === "1,2", "the maker's page: editable, each moment's points (Won the Mission 2), the moments added, Episodes 1-2 researched", JSON.stringify({ editable: page?.editable, researched: page?.researched }));
    const votes = page?.questions?.find((q) => q.key === "roundTableVotesReceived");
    check(votes?.type === "integer" && /vote/i.test(votes.words), "the questions to score from include the Round Table's votes received", JSON.stringify(votes));
    const theirs = (await scoring("friend")).body;
    check(theirs?.editable === false && /whoever made it a game/.test(theirs.why), "someone else sees it read-only, with why", JSON.stringify(theirs?.why));
    check((await save("friend", { points: { missionWon: 5 } })).status === 403, "and can't save");

    // Step 1's "the show changed" edit set points of its own (an edit keeps the block whole), so it would undo a fix's from
    // Episode 2: refused, with why (BACKLOG). Withdrawn, the rest is a made game as its maker has it.
    const blocked = await save("watcher", { points: { missionWon: 5 } });
    check(blocked.status === 409 && /show changed from Episode 2/.test(blocked.body?.error ?? ""), "a later show change with its own points: the maker's points change refused, with why", JSON.stringify(blocked.body));
    await pool.query("UPDATE rulebook_edits SET status = 'withdrawn' WHERE rulebook_id = $1", [book.id]);
    await Rulebooks.saveChain(pool, book.id, {});

    // A moment's points: the stored answers counted again, no research.
    const before = await stats();
    const winner = before.cast.find((c) => c.counts?.missionWon);
    const raised = await save("watcher", { points: { missionWon: 5 } });
    const after = await stats();
    const winnerAfter = after.cast.find((c) => c.name === winner?.name);
    check(
      raised.status === 200 && raised.body.ask.length === 0 && winner && winnerAfter.points - winner.points === winner.counts.missionWon * 3,
      "Won the Mission 2 → 5: the Players tab recounts at once (+3 a win)",
      JSON.stringify({ status: raised.status, who: winner?.name, before: winner?.points, after: winnerAfter?.points, wins: winner?.counts?.missionWon })
    );

    // A moment scored from an answer already asked: counted from the stored answers, no research.
    const perVote = await save("watcher", { add: [{ label: "Each vote received at the Round Table", counted: "eachTime", points: -0.5, uses: "roundTableVotesReceived" }] });
    const s3 = await stats();
    const eli3 = s3.cast.find((c) => c.name === WHO);
    const voteKey = moment(perVote.body?.page, "eachVoteReceivedAtTheRoundTable") ? "eachVoteReceivedAtTheRoundTable" : null;
    check(perVote.status === 200 && perVote.body.ask.length === 0 && voteKey && moment(perVote.body.page, voteKey).uses === "roundTableVotesReceived", "−0.5 a vote received, from the votes question already asked: saved, nothing to look up again", JSON.stringify(perVote.body?.ask ?? perVote.body));
    check(eli3?.counts?.[voteKey] === 4 && s3.stats.some((s) => s.key === voteKey), "Eli's 2 + 2 votes counted from the stored answers (a stat of its own)", JSON.stringify(eli3?.counts));

    // A moment with a question of its own: the save says it needs the episodes looked up again.
    const cloak = await save("watcher", { add: [{ label: "Wore a cloak", counted: "yesNo", points: 1 }] });
    check(cloak.status === 200 && cloak.body.ask.length === 1 && cloak.body.ask[0].label === "Wore a cloak", "Wore a cloak (a new question): saved, and it says the episodes need looking up for it", JSON.stringify(cloak.body?.ask ?? cloak.body));
    const fmt = (await pool.query("SELECT data FROM show_formats WHERE id = $1", [`made-${fx.SLUG}`])).rows[0]?.data;
    check(fmt?.research?.checklist?.some((f) => f.key === "woreACloak"), "the stored format is kept in step");
    check(bot.asked.length === asksBefore, "none of it asked our bot anything");

    // Refused: out of range, a question of the wrong kind, nothing changed, a built-in moment taken out.
    check((await save("watcher", { points: { missionWon: 30 } })).status === 400, "points past 20 refused");
    check((await save("watcher", { add: [{ label: "Voted out loud", counted: "eachTime", points: 1, uses: "roundTableAttended" }] })).status === 400, "counting a yes-or-no question refused");
    check((await save("watcher", { points: { missionWon: 5 } })).status === 400, "nothing changed refused");
    check((await save("watcher", { remove: ["missionWon"] })).status === 400, "a built-in moment can't be taken out");
    const removed = await save("watcher", { remove: ["woreACloak"] });
    check(removed.status === 200 && !moment(removed.body.page, "woreACloak"), "a moment added by hand can");

    // A game on the season: its scoring is every game's now.
    const { rows: gate } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ('ZT RA gate', 'zt-ra-gate', $1, jsonb_build_object('settings', jsonb_build_object('showId', $2::text, 'wikiSeason', '5')), (SELECT id FROM "user" WHERE username = 'zt_ra_watcher')) RETURNING id`,
      [`ZTMS${Date.now() % 100000}`, fx.SLUG]
    );
    const locked = (await scoring("watcher")).body;
    check(locked?.editable === false && /game's being played/.test(locked.why) && (await save("watcher", { points: { missionWon: 4 } })).status === 403, "a game played on it: read-only for the maker too, with why", JSON.stringify(locked?.why));
    await pool.query("DELETE FROM leagues WHERE id = $1", [gate[0].id]);

    // ---- step 5: looking them up again ----
    // Episodes 3 and 4 are still waiting from step 1 (their first asks, the whole checklist): they go first, then 1 and 2.
    const facts = async () =>
      (await pool.query("SELECT episode_number AS ep, castaway_name AS who, event_type AS e FROM season_decisions WHERE season_id = $1 AND status = 'accepted' AND episode_number <= 2 ORDER BY 1, 2, 3", [sid])).rows.map(
        (r) => `${r.ep}:${r.who}:${r.e}`
      );
    const recapsOf = async () => (await as.watcher.call("GET", `/api/seasons/${sid}/recaps`)).body?.results;
    const runAll = async () => {
      const done = [];
      for (let i = 0, r; i < 8 && (r = await tick()); i++) done.push(r);
      return done;
    };
    const wore = await save("watcher", { add: [{ label: WORE.label, counted: "yesNo", points: 1 }] });
    check(wore.status === 200 && wore.body.ask.length === 1 && wore.body.page.behind.join() === "1,2", "Wore a cloak again: Episodes 1-2 have no answer to it (behind)", JSON.stringify(wore.body?.page?.behind ?? wore.body));
    check((await save("friend", { again: "missing" })).status === 403, "someone else can't ask them again");
    check((await save("watcher", { again: "sideways" })).status === 400, "only just the new questions, or everything");
    const was = await facts();
    const asksAt = bot.asked.length;
    const again = await save("watcher", { again: "missing" });
    check(again.status === 200 && again.body.asked === 2 && again.body.page.again.join() === "1,2" && again.body.page.behind.length === 0, "Just the new question: Episodes 1-2 asked again (and no longer behind)", JSON.stringify(again.body));
    const rc = await recapsOf();
    check(rc?.asked?.filter((a) => a.again === "missing").map((a) => a.episode).join() === "1,2", "the roll call knows they're for the new question", JSON.stringify(rc?.asked));
    const ran = await runAll();
    check(ran.map((r) => r.job?.episode).join() === "3,4,1,2" && ran.every((r) => r.ok), "the clock: 3 and 4's first asks, then 1 and 2 again", JSON.stringify(ran.map((r) => [r.job?.episode, r.message])));
    const cut = bot.asked.slice(asksAt).filter((q) => q.kind === "full" && [1, 2].includes(fx.skeletonOf(q.prompt).n));
    const entryKeys = cut.map((q) => Object.keys(fx.skeletonOf(q.prompt).a.castaways[0]).sort().join());
    check(cut.length === 2 && entryKeys.every((k) => k === "confidence,exitMethod,leftTheGame,name,sources,woreACloak"), "their prompts ask the core fields and the new question only", JSON.stringify(entryKeys));
    check(cut.every((q) => !q.prompt.includes("roundTableVotesReceived") && !q.prompt.includes("betAnswers")), "nothing else is asked (no votes, no side bets)");
    const now5 = await facts();
    const lost = was.filter((f) => !now5.includes(f));
    check(!lost.length, "every earlier result still counts (the merged answer is what's filed)", JSON.stringify(lost));
    check(now5.includes(`1:${WHO}:woreACloak`) && now5.includes(`2:${WHO}:woreACloak`), "and the new one counts: Eli wore a cloak in 1 and 2", JSON.stringify(now5.filter((f) => f.includes("woreACloak"))));
    const s5 = await stats();
    const eli5 = s5.cast.find((c) => c.name === WHO);
    check(eli5?.counts?.woreACloak >= 2 && eli5.counts[CRIED.id] >= 2 && eli5.counts[voteKey] >= 4, "the Players tab: the cloak counted, the tears and votes from before still there", JSON.stringify(eli5?.counts));
    const p5 = (await scoring("watcher")).body;
    check(p5?.behind?.length === 0 && p5.again.length === 0, "the page: nothing behind, nothing being asked", JSON.stringify({ behind: p5?.behind, again: p5?.again }));
    check((await save("watcher", { again: "missing" })).status === 400, "just the new question with nothing behind: refused, with why");

    // Nothing new to ask (a question answered meanwhile): the run says so without asking.
    await pool.query("UPDATE research_asks SET mode = 'missing', asked_at = now(), done_at = NULL, ok = NULL, found = NULL WHERE season_id = $1 AND episode_number = 1", [sid]);
    const asks0 = bot.asked.length;
    const none = await runAll();
    check(none.length === 1 && none[0].ok && /Nothing new to ask/.test(none[0].message) && bot.asked.length === asks0, "an episode with every answer already: done without asking", JSON.stringify(none.map((r) => r.message)));

    // Everything again: the whole checklist, merged.
    const all = await save("watcher", { again: "full" });
    check(all.status === 200 && all.body.asked === 4, "Everything again: every episode looked up (1-4) asked again", JSON.stringify(all.body?.asked ?? all.body));
    const asksF = bot.asked.length;
    const ranF = await runAll();
    const fullPrompts = bot.asked.slice(asksF).filter((q) => q.kind === "full");
    check(ranF.length === 4 && ranF.every((r) => r.ok) && fullPrompts.every((q) => q.prompt.includes("roundTableVotesReceived") && q.prompt.includes("woreACloak")), "the whole checklist each time", JSON.stringify(ranF.map((r) => r.message)));
    const nowF = await facts();
    check(!now5.filter((f) => !nowF.includes(f)).length, "and every result still counts", JSON.stringify(now5.filter((f) => !nowF.includes(f))));

    // ---- step 6 (docs/PLAN-start-a-game-gpt.md S2 part 2): a new Survivor season, Survivor's blocks compiled ----
    // Its moments are recorded under Survivor's event ids (its aliases): the page lists each by its own id, which is what's
    // saved, and a moment worth something else where castaways can be on several teams keeps both worths. Its maker here is
    // the watcher (on a real one it's a site admin, until a game is played on it).
    const survivorSeason = await freshSurvivor(pool);
    const sv = (body) => (body ? as.watcher.call("POST", `/api/seasons/${survivorSeason}/scoring`, body) : as.watcher.call("GET", `/api/seasons/${survivorSeason}/scoring`));
    const svPage = (await sv()).body;
    const imm = moment(svPage, "immunityChallengeWon");
    check(
      svPage?.editable === true && imm?.points === 3 && imm?.shared === 4 && !moment(svPage, "individualImmunity") && moment(svPage, "tribalCouncilZeroVotes")?.shared === 1,
      "a Survivor season from its blocks: each moment by its own id (not the event id it's recorded under), both worths",
      JSON.stringify({ editable: svPage?.editable, imm })
    );
    const split = await sv({ points: { immunityChallengeWon: { exclusive: 3.5, shared: 4.5 } } });
    const svRow = async () => (await pool.query("SELECT r.blocks, r.compiled FROM rulebooks r JOIN show_seasons ss ON ss.rulebook_id = r.id WHERE ss.id = $1", [survivorSeason])).rows[0];
    // (jsonb gives { shared, exclusive } back in its own key order.)
    const worth = (p, exclusive, shared) => !!p && p.exclusive === exclusive && p.shared === shared;
    let stored = await svRow();
    check(
      split.status === 200 && worth(stored.blocks.points.immunityChallengeWon, 3.5, 4.5) &&
        worth(stored.compiled.events.find((e) => e.id === "individualImmunity")?.defaultPoints, 3.5, 4.5),
      "saved by its own id, both worths kept: what the recorded event scores",
      JSON.stringify({ status: split.status, points: stored.blocks.points.immunityChallengeWon })
    );
    check((await sv({ points: { individualImmunity: 5 } })).status === 400, "an event id isn't a moment: refused");

    // ---- step 4: the Scoring page, in a real browser ----
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
      const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth);
      const users = Object.fromEntries((await pool.query(`SELECT username, id FROM "user" WHERE username LIKE 'zt\_ra\_%'`)).rows.map((r) => [r.username, r.id]));
      for (const who of ["watcher", "friend"]) {
        const b = await open({ user: `zt_ra_${who}`, pass: fx.PASSWORD, width, headers });
        b.page.on("pageerror", (e) => check(false, `no page errors (${who})`, e.message));
        if (theme) {
          const t = theme === "light" ? "studio" : "night";
          await pool.query("UPDATE user_settings SET theme = $2 WHERE user_id = $1", [users[`zt_ra_${who}`], t]);
          await b.page.context().addCookies([{ name: "gys_theme", value: t, url: BASE }]);
        }
        const { page } = b;
        try {
          await page.goto(`${BASE}/show/${sid}/cast`);
          await page.locator("[data-explorer]").first().waitFor({ timeout: 20_000 });
          await page.waitForTimeout(800);
          const link = await page.locator("[data-scoring-link]").count();
          if (who === "friend") {
            check(link === 0, "a follower's Players tab has no Change the scoring");
            await page.goto(`${BASE}/show/${sid}/scoring`);
            await page.locator("[data-scoring]").waitFor({ timeout: 20_000 });
            check((await page.locator('[data-scoring="read"]').count()) === 1 && /whoever made it a game/.test(await page.locator("[data-scoring-line]").innerText()) && (await page.locator("[data-scoring-add]").count()) === 0, "the page reads as the rules for them, with why");
            await shot(page, "scoring-read");
            continue;
          }
          check(link === 1, "the maker's Players tab: Change the scoring");
          await page.locator("[data-scoring-link]").click();
          await page.locator('[data-scoring="edit"]').waitFor({ timeout: 20_000 });
          check((await page.locator('[data-scoring-moment="missionWon"]').count()) === 1 && (await wide(page)) <= width, "the Scoring page: every moment with its points, fits the screen");
          await shot(page, "scoring-edit");
          await page.locator('[data-scoring-moment="missionWon"] button[aria-label="More"]').click();
          await page.locator("[data-scoring-bar]").waitFor({ timeout: 5_000 });
          check(/1 moment changed/.test(await page.locator("[data-scoring-bar]").innerText()), "+ on Won the Mission: the save bar says 1 changed");
          await shot(page, "scoring-bar");
          await page.locator("[data-scoring-save]").click();
          await page.locator("[data-scoring-bar]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
          const pts = (await pool.query("SELECT r.blocks->'points'->>'missionWon' AS p FROM rulebooks r JOIN show_seasons ss ON ss.rulebook_id = r.id WHERE ss.id = $1", [sid])).rows[0]?.p;
          check(pts === "5.5", "saved: Won the Mission 5.5", pts);
          // Add a moment from an answer research already gets.
          await page.locator("[data-scoring-add]").click();
          await page.locator("[data-scoring-add-sheet]").waitFor({ timeout: 5_000 });
          await page.locator("[data-scoring-label]").fill("Took a shield");
          await page.locator('[data-scoring-from="asked"]').click();
          await page.locator('[data-scoring-question="shieldsGot"]').click();
          await shot(page, "scoring-add-sheet");
          await page.locator("[data-scoring-add-it]").click();
          await page.locator('[data-scoring-moment="tookAShield"]').waitFor({ timeout: 15_000 }).catch(() => {});
          check(/From:/.test((await page.locator('[data-scoring-moment="tookAShield"]').count()) ? await page.locator('[data-scoring-moment="tookAShield"]').innerText() : ""), "Add a moment from an answer we get: on the page, saying what it's from");
          check((await wide(page)) <= width, "still fits the screen");
          await shot(page, "scoring-added");
          // Step 5: a moment with a question of its own offers to look the episodes up again.
          await page.locator("[data-scoring-add]").click();
          await page.locator("[data-scoring-add-sheet]").waitFor({ timeout: 5_000 });
          await page.locator("[data-scoring-label]").fill("Spoke in riddles");
          await page.locator("[data-scoring-add-it]").click();
          await page.locator("[data-scoring-again-sheet]").waitFor({ timeout: 15_000 }).catch(() => {});
          const sheet = (await page.locator("[data-scoring-again-sheet]").count()) ? await page.locator("[role=dialog]").last().innerText() : "";
          check(/Episodes 1–4 were looked up before th(is|ese) questions?/.test(sheet) && /Just the new question/.test(sheet) && /Everything again/.test(sheet), "a new question: the sheet offers Just the new question or Everything again", sheet.slice(0, 200));
          await shot(page, "scoring-again-sheet");
          await page.locator("[data-scoring-again-later]").click();
          await page.locator('[data-scoring-again="behind"]').waitFor({ timeout: 5_000 }).catch(() => {});
          check(/Episodes 1–4 have no answer to a new question yet/.test((await page.locator('[data-scoring-again="behind"]').count()) ? await page.locator('[data-scoring-again="behind"]').innerText() : ""), "Not now: the page keeps saying which episodes have no answer to it");
          await shot(page, "scoring-behind");
          await page.locator("[data-scoring-again-open]").click();
          await page.locator('[data-scoring-again-mode="missing"]').click();
          await page.locator('[data-scoring-again="asking"]').waitFor({ timeout: 15_000 }).catch(() => {});
          check((await page.locator('[data-scoring-again="asking"]').count()) === 1 && (await page.locator('[data-scoring-again="behind"]').count()) === 0 && (await wide(page)) <= width, "asked: the page says they're being looked up again (and fits)");
          await shot(page, "scoring-asking");
          await page.locator('[data-scoring-again="asking"]').click();
          await page.locator("[data-results-now]").waitFor({ timeout: 20_000 }).catch(() => {});
          const roll = (await page.locator("[data-results-again]").count()) ? await page.locator("[data-results-again]").innerText() : "";
          check(/^The new question · /.test(roll) && (await wide(page)) <= width, "the Episodes tab's roll call: the next one's for the new question", roll);
          await page.waitForURL(/\/episodes/, { timeout: 10_000 }).catch(() => {});
          await page.locator("[data-results-progress]").scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
          await shot(page, "episodes-again");
        } finally {
          await b.close();
        }
      }
      // Step 6 in the browser: the Survivor season's split worth, moved with + and saved whole.
      const b = await open({ user: "zt_ra_watcher", pass: fx.PASSWORD, width, headers });
      b.page.on("pageerror", (e) => check(false, "no page errors (the Survivor season)", e.message));
      if (theme) await b.page.context().addCookies([{ name: "gys_theme", value: theme === "light" ? "studio" : "night", url: BASE }]);
      try {
        const { page } = b;
        await page.goto(`${BASE}/show/${survivorSeason}/scoring`);
        await page.locator('[data-scoring="edit"]').waitFor({ timeout: 20_000 });
        const row = page.locator('[data-scoring-moment="immunityChallengeWon"]');
        const value = () => row.locator("b.type-num").innerText();
        check(/\+4\.5 if on several teams/.test(await row.innerText()) && (await value()) === "+3.5" && (await wide(page)) <= width, "a moment worth more on several teams says so, and the page fits", await row.innerText());
        await shot(page, "scoring-split");
        await row.locator('button[aria-label="More"]').click();
        await page.locator("[data-scoring-bar]").waitFor({ timeout: 5_000 });
        const moved = await row.innerText();
        check((await value()) === "+4" && /Was \+3\.5 \/ \+4\.5/.test(moved) && /\+5 if on several teams/.test(moved) && (await wide(page)) <= width, "+ moves both, and says what they were", moved);
        await shot(page, "scoring-split-moved");
        await page.locator("[data-scoring-save]").click();
        await page.locator("[data-scoring-bar]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
        stored = await svRow();
        check(worth(stored.blocks.points.immunityChallengeWon, 4, 5), "saved: 4, and 5 on several teams", JSON.stringify(stored.blocks.points.immunityChallengeWon));
      } finally {
        await b.close();
      }
    }
  } finally {
    await bot.close();
    await tv.close();
    if (!keep) await dropSurvivor(pool);
    if (!keep) await fx.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
